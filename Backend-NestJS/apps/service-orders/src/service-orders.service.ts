import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize, Transaction } from 'sequelize';
import { CreateOrderDto } from './orders/create-order.dto.js';
import { Order } from './orders/order.model.js';
import { OrderEventPublisher } from './events/order-event-publisher.js';
import { Cart } from './cart/cart.model.js';
import { AddCartItemDto } from './cart/cart.dto.js';
import { CheckoutDto } from './orders/checkout.dto.js';
import { OrderItem } from './orders/order-item.model.js';
import {
  CatalogInternalClient,
  type InventoryReservation,
} from './catalog-internal.client.js';

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    @InjectModel(Order) private readonly orders: typeof Order,
    @InjectModel(OrderItem) private readonly orderItems: typeof OrderItem,
    @InjectModel(Cart) private readonly cart: typeof Cart,
    @InjectConnection() private readonly database: Sequelize,
    private readonly events: OrderEventPublisher,
    private readonly catalog: CatalogInternalClient,
  ) {}

  async create(input: CreateOrderDto, userId: number) {
    let order: Order;
    try {
      order = await this.orders.create({
        totalValue: input.totalValue,
        paymentMethod: input.paymentMethod,
        address: input.address,
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
      }],
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      distinct: true,
    });

    const total = count;

    return {
      orders: rows.map((order) => ({
        ...order.get({ plain: true }),
        OrderItems: (order.OrderItems ?? []).map((item) => ({
          ...item.get({ plain: true }),
          Product: {
            id: item.productId,
            name: item.productName ?? `Produto #${item.productId}`,
            image_url: item.productImageUrl,
          },
        })),
      })),
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async listCart(userId: number) {
    const items = await this.cart.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });
    const resolvedItems = await Promise.all(items.map(async (item) => {
      try {
        return {
          ...item.get({ plain: true }),
          Product: await this.catalog.getProduct(item.productId),
        };
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;

        this.logger.warn(
          `Removing unavailable product #${item.productId} from cart item #${item.id} for user #${userId}`,
        );
        await this.cart.destroy({ where: { id: item.id, userId } });
        return null;
      }
    }));

    return {
      items: resolvedItems.filter((item) => item !== null),
    };
  }

  async addCartItem(input: AddCartItemDto, userId: number) {
    await this.catalog.getProduct(input.productId);

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
    const user = await this.catalog.getUser(userId);
    const items = await this.cart.findAll({ where: { userId } });
    if (items.length === 0) throw new BadRequestException('Carrinho vazio');

    const reservations: InventoryReservation[] = [];
    let transaction: Transaction | undefined;
    let committed = false;
    let order: Order;
    try {
      for (const item of items) {
        reservations.push(await this.catalog.reserve({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
        }));
      }

      transaction = await this.database.transaction();
      let totalValue = 0;
      reservations.forEach((reservation) => {
        totalValue += reservation.unitPrice * reservation.quantity;
      });

      order = await this.orders.create({
        userId,
        totalValue,
        paymentMethod: input.paymentMethod,
        address: input.address || user.address || '',
        status: 'pago',
      }, { transaction });

      for (const reservation of reservations) {
        await this.orderItems.create({
          orderId: order.id,
          productId: reservation.productId,
          quantity: reservation.quantity,
          priceAtPurchase: reservation.unitPrice,
          size: reservation.size,
          productName: reservation.productName,
          productImageUrl: reservation.productImageUrl,
        }, { transaction });
      }

      await this.cart.destroy({ where: { userId }, transaction });
      await transaction.commit();
      committed = true;
    } catch (error) {
      if (transaction && !committed) await transaction.rollback();
      try {
        await this.releaseReservations(reservations);
      } catch (releaseError) {
        this.logger.error('Failed to restore reserved catalog stock', releaseError);
        throw new InternalServerErrorException(
          'Checkout falhou e o estoque reservado não pôde ser totalmente estornado',
        );
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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

  private async releaseReservations(reservations: InventoryReservation[]) {
    const failures: unknown[] = [];
    for (const reservation of [...reservations].reverse()) {
      try {
        await this.catalog.release({
          productId: reservation.productId,
          quantity: reservation.quantity,
          size: reservation.size,
        });
      } catch (error) {
        this.logger.error(
          `Failed to restore stock for product #${reservation.productId}`,
          error,
        );
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new InternalServerErrorException(
        `Não foi possível estornar ${failures.length} reserva(s) de estoque`,
      );
    }
  }
}
