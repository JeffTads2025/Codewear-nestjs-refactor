import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Includeable } from 'sequelize';
import { RedisService } from '../redis/redis.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { UpdateProductStockDto } from './dto/update-product-stock.dto.js';
import { Product } from './product.model.js';
import { ProductSize } from './product-size.model.js';
import { Promotion } from './promotion.model.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly cacheTtl = Math.max(
    1,
    Number(process.env.CACHE_TTL_SECONDS) || 60,
  );

  constructor(
    @InjectModel(Product) private readonly products: typeof Product,
    @InjectModel(Promotion) private readonly promotions: typeof Promotion,
    private readonly redis: RedisService,
  ) {}

  async list(pageQuery = '1', limitQuery = '10') {
    const page = Number.parseInt(pageQuery, 10) || 1;
    const limit = Number.parseInt(limitQuery, 10) || 10;
    const cacheKey = `catalog:products:page:${page}:limit:${limit}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.log(`GET /products source=CACHE key=${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Redis cache read failed; querying database: ${error}`);
    }

    try {
      const { count, rows } = await this.products.findAndCountAll({
        where: { isVisible: true },
        limit,
        offset: (page - 1) * limit,
        order: [['createdAt', 'DESC']],
        include: [
          { model: ProductSize, as: 'sizes' },
          { model: Promotion, as: 'promotions' },
        ] as Includeable[],
        distinct: true,
      });

      const storePromotion = await this.promotions.findOne({
        where: { productId: null, code: null },
      });

      if (storePromotion && this.isPromotionActive(storePromotion)) {
        rows.forEach((product) => {
          product.promotions = [...(product.promotions ?? []), storePromotion];
        });
      }

      const result = {
        products: rows,
        totalPages: Math.ceil(count / limit),
        total: count,
      };

      this.logger.log(`GET /products source=DATABASE key=${cacheKey}`);
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), this.cacheTtl);
      } catch (error) {
        this.logger.warn(`Redis cache write failed: ${error}`);
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to list products', error);
      throw new InternalServerErrorException('Erro ao listar produtos');
    }
  }

  async findById(id: number) {
    try {
      const product = await this.products.findByPk(id, {
        include: [
          { model: ProductSize, as: 'sizes' },
          { model: Promotion, as: 'promotions' },
        ] as Includeable[],
      });
      if (!product) throw new NotFoundException('Produto não encontrado');
      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to find product #${id}`, error);
      throw new InternalServerErrorException('Erro ao buscar produto');
    }
  }

  async create(input: CreateProductDto) {
    try {
      const product = await this.products.create({
        name: input.name,
        price: input.price,
        description: input.description,
        category: input.category,
        stock: input.stock,
        image_url: input.image_url,
      });
      await this.invalidateCache();
      return { message: 'Produto criado com sucesso', product };
    } catch (error) {
      this.logger.error('Failed to create product', error);
      throw new InternalServerErrorException('Erro ao criar produto');
    }
  }

  async update(id: number, input: UpdateProductDto) {
    try {
      const product = await this.products.findByPk(id);
      if (!product) throw new NotFoundException('Produto não encontrado');

      await product.update(input);
      await this.invalidateCache();
      return { message: 'Produto atualizado com sucesso', product };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error('Failed to update product', error);
      throw new InternalServerErrorException('Erro ao atualizar produto');
    }
  }

  updateStock(id: number, input: UpdateProductStockDto) {
    return this.update(id, input);
  }

  async delete(id: number) {
    try {
      const product = await this.products.findByPk(id);
      if (!product) throw new NotFoundException('Produto não encontrado');

      await product.update({ isVisible: false });
      await this.invalidateCache();
      return { message: 'Produto excluído com sucesso' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error('Failed to delete product', error);
      throw new InternalServerErrorException('Erro ao excluir produto');
    }
  }

  private async invalidateCache() {
    try {
      await this.redis.deletePattern('catalog:products:*');
      this.logger.log('Invalidated product catalog cache');
    } catch (error) {
      this.logger.error('Failed to invalidate product catalog cache', error);
      throw error;
    }
  }

  private isPromotionActive(promotion: Promotion): boolean {
    const now = new Date();
    return promotion.isActive
      && (!promotion.validFrom || promotion.validFrom <= now)
      && (!promotion.validUntil || promotion.validUntil >= now)
      && Number(promotion.discountPercentage) > 0;
  }
}
