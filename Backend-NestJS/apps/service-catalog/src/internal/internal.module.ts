import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../auth/user.model.js';
import { Product } from '../products/product.model.js';
import { ProductSize } from '../products/product-size.model.js';
import { Promotion } from '../products/promotion.model.js';
import { RedisModule } from '../redis/redis.module.js';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import { InternalController } from './internal.controller.js';
import { InternalService } from './internal.service.js';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Product, ProductSize, Promotion]),
    RedisModule,
  ],
  controllers: [InternalController],
  providers: [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}
