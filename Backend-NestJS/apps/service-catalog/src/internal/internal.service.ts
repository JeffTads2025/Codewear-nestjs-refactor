import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize, Transaction } from 'sequelize';
import { User } from '../auth/user.model.js';
import { Product } from '../products/product.model.js';
import { ProductSize } from '../products/product-size.model.js';
import { Promotion } from '../products/promotion.model.js';
import { RedisService } from '../redis/redis.service.js';
import { InternalInventoryDto } from './internal-inventory.dto.js';

@Injectable()
export class InternalService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Product) private readonly products: typeof Product,
    @InjectModel(ProductSize) private readonly productSizes: typeof ProductSize,
    @InjectModel(Promotion) private readonly promotions: typeof Promotion,
    @InjectConnection() private readonly database: Sequelize,
    private readonly redis: RedisService,
  ) {}

  async getUser(id: number) {
    const user = await this.users.findByPk(id, {
      attributes: ['id', 'name', 'address', 'isActive'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.isActive) throw new ForbiddenException('Usuário inativo');
    return this.userSummary(user);
  }

  async getUserSummary(id: number) {
    const user = await this.users.findByPk(id, {
      attributes: ['id', 'name'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.userSummary(user);
  }

  async countActiveCustomers() {
    const count = await this.users.count({
      where: { role: 'client', isActive: true },
    });
    return { count };
  }

  async getProduct(id: number) {
    const product = await this.products.findByPk(id, {
      include: [
        { model: ProductSize, as: 'sizes' },
        { model: Promotion, as: 'promotions' },
      ],
    });
    if (!product || !product.isVisible) {
      throw new NotFoundException('Produto não encontrado');
    }

    const storePromotion = await this.promotions.findOne({
      where: { productId: null, code: null },
    });
    const promotions = [
      ...(product.promotions ?? []),
      ...(storePromotion ? [storePromotion] : []),
    ];

    return {
      ...product.get({ plain: true }),
      price: Number(product.price),
      currentPrice: this.currentPrice(Number(product.price), promotions),
      promotions,
    };
  }

  async reserve(input: InternalInventoryDto) {
    const transaction = await this.database.transaction();
    let committed = false;
    try {
      const product = await this.products.findByPk(input.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product || !product.isVisible) {
        throw new NotFoundException('Produto não encontrado');
      }
      if (product.stock < input.quantity) {
        throw new BadRequestException(`Estoque insuficiente: ${product.name}`);
      }

      let size: ProductSize | null = null;
      if (input.size) {
        size = await this.productSizes.findOne({
          where: { productId: product.id, size: input.size },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!size) throw new NotFoundException('Tamanho não encontrado');
      }
      const availableStock = size ? size.stock : product.stock;
      if (availableStock < input.quantity) {
        throw new BadRequestException(`Estoque insuficiente: ${product.name}`);
      }

      const currentPrice = await this.getCurrentPrice(product.id, Number(product.price), transaction);
      if (size) {
        await size.decrement('stock', {
          by: input.quantity,
          transaction,
        });
      }
      await product.decrement('stock', {
        by: input.quantity,
        transaction,
      });
      await transaction.commit();
      committed = true;
      await this.invalidateProductCache();

      return {
        productId: product.id,
        productName: product.name,
        productImageUrl: product.image_url ?? null,
        quantity: input.quantity,
        size: input.size ?? null,
        unitPrice: currentPrice,
      };
    } catch (error) {
      if (!committed) await transaction.rollback();
      throw error;
    }
  }

  async release(input: InternalInventoryDto) {
    const transaction = await this.database.transaction();
    let committed = false;
    try {
      const product = await this.products.findByPk(input.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) throw new NotFoundException('Produto não encontrado');

      if (input.size) {
        const size = await this.productSizes.findOne({
          where: { productId: product.id, size: input.size },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!size) throw new NotFoundException('Tamanho não encontrado');
        await size.increment('stock', { by: input.quantity, transaction });
      }
      await product.increment('stock', { by: input.quantity, transaction });

      await transaction.commit();
      committed = true;
      await this.invalidateProductCache();
    } catch (error) {
      if (!committed) await transaction.rollback();
      throw error;
    }
  }

  private invalidateProductCache() {
    return this.redis.deletePattern('catalog:products:*');
  }

  private userSummary(user: User) {
    return {
      id: user.id,
      name: user.name,
      address: user.address ?? null,
    };
  }

  private async getCurrentPrice(
    productId: number,
    basePrice: number,
    transaction: Transaction,
  ) {
    const [productPromotions, storePromotion] = await Promise.all([
      this.promotions.findAll({
        where: { productId, code: null },
        transaction,
      }),
      this.promotions.findOne({
        where: { productId: null, code: null },
        transaction,
      }),
    ]);
    return this.currentPrice(
      basePrice,
      [...productPromotions, ...(storePromotion ? [storePromotion] : [])],
    );
  }

  private currentPrice(basePrice: number, promotions: Promotion[]) {
    const now = new Date();
    const promotion = promotions.find((candidate) =>
      candidate.isActive
        && (!candidate.validFrom || candidate.validFrom <= now)
        && (!candidate.validUntil || candidate.validUntil >= now)
        && Number(candidate.discountPercentage) > 0,
    );
    const discount = promotion ? Number(promotion.discountPercentage) : 0;
    return Number((basePrice * (1 - discount / 100)).toFixed(2));
  }
}
