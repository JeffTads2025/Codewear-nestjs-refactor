import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { CreateOrderDto } from './orders/create-order.dto.js';
import { Order } from './orders/order.model.js';
import { OrderEventPublisher } from './events/order-event-publisher.js';
import { Cart } from './cart/cart.model.js';
import { AddCartItemDto } from './cart/cart.dto.js';
import { CheckoutDto } from './orders/checkout.dto.js';
import { OrderItem } from './orders/order-item.model.js';
import { Product } from './orders/product.model.js';

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    @InjectModel(Order) private readonly orders: typeof Order,
    @InjectModel(OrderItem) private readonly orderItems: typeof OrderItem,
    @InjectModel(Cart) private readonly cart: typeof Cart,
    @InjectModel(Product) private readonly products: typeof Product,
    @InjectConnection() private readonly database: Sequelize,
    private readonly events: OrderEventPublisher,
  ) {}

  async create(input: CreateOrderDto, userId: number) {
    let order: Order;
    try {
      order = await this.orders.create({
        ...input,
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to create order', error);
      throw new InternalServerErrorException('Erro ao criar pedido');
    }

    try {
      await this.events.publishOrderCreated(order.id);
    } catch (error) {
      this.logger.error(
        `[Pub/Sub] Pedido #${order.id} criado, mas o evento não foi publicado`,
        error,
      );
      throw new InternalServerErrorException(
        `Pedido #${order.id} criado, mas não foi possível publicar o evento`,
      );
    }

    return { message: 'Pedido criado com sucesso', order };
  }

  async listOrders(userId: number, page = 1, limit = 50) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 50;
    const { count, rows } = await this.orders.findAndCountAll({
      where: { userId },
      include: [{
        model: OrderItem,
        as: 'OrderItems',
        include: [{
          model: Product,
          as: 'Product',
          attributes: ['id', 'name', 'image_url'],
        }],
      }],
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      distinct: true,
    });

    return { orders: rows, totalPages: Math.ceil(count / safeLimit) };
  }

  async listCart(userId: number) {
    const items = await this.cart.findAll({
      where: { userId },
      include: [{
        model: Product,
        as: 'Product',
        attributes: ['id', 'name', 'price', 'image_url', 'stock'],
      }],
      order: [['createdAt', 'ASC']],
    });
    return { items };
  }

  async addCartItem(input: AddCartItemDto, userId: number) {
    const product = await this.products.findByPk(input.productId);
    if (!product) throw new NotFoundException('Produto não encontrado');

    const existing = await this.cart.findOne({
      where: {
        userId,
        productId: input.productId,
        size: input.size ?? null,
      },
    });
    if (existing) {
      existing.quantity += input.quantity;
      await existing.save();
      return existing;
    }

    return this.cart.create({
      userId,
      productId: input.productId,
      quantity: input.quantity,
      size: input.size ?? null,
    });
  }

  async updateCartItem(id: number, quantity: number, userId: number) {
    const item = await this.cart.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('Item do carrinho não encontrado');
    item.quantity = quantity;
    await item.save();
    return item;
  }

  async removeCartItem(id: number, userId: number) {
    const deleted = await this.cart.destroy({ where: { id, userId } });
    if (!deleted) throw new NotFoundException('Item do carrinho não encontrado');
    return { message: 'Item removido do carrinho' };
  }

  async checkout(input: CheckoutDto, userId: number) {
    const transaction = await this.database.transaction();
    let order: Order;
    try {
      const items = await this.cart.findAll({
        where: { userId },
        transaction,
      });
      if (items.length === 0) throw new BadRequestException('Carrinho vazio');

      const products: Array<{ cartItem: Cart; product: Product }> = [];
      let totalValue = 0;
      for (const cartItem of items) {
        const product = await this.products.findByPk(cartItem.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product) {
          throw new BadRequestException(
            `Produto ${cartItem.productId} não encontrado`,
          );
        }
        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(`Estoque insuficiente: ${product.name}`);
        }
        products.push({ cartItem, product });
        totalValue += Number(product.price) * cartItem.quantity;
      }

      order = await this.orders.create({
        userId,
        totalValue,
        paymentMethod: input.paymentMethod,
        address: input.address,
        status: 'pago',
      }, { transaction });

      for (const { cartItem, product } of products) {
        await this.orderItems.create({
          orderId: order.id,
          productId: product.id,
          quantity: cartItem.quantity,
          priceAtPurchase: product.price,
          size: cartItem.size,
        }, { transaction });
        await product.decrement('stock', {
          by: cartItem.quantity,
          transaction,
        });
      }

      await this.cart.destroy({ where: { userId }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Failed to complete checkout', error);
      throw new InternalServerErrorException('Erro ao finalizar compra');
    }

    try {
      await this.events.publishOrderCreated(order.id);
    } catch (error) {
      this.logger.error(
        `[Pub/Sub] Pedido #${order.id} criado, mas o evento não foi publicado`,
        error,
      );
      throw new InternalServerErrorException(
        `Pedido #${order.id} criado, mas não foi possível publicar o evento`,
      );
    }

    return { message: 'Compra realizada com sucesso', orderId: order.id };
  }
}
