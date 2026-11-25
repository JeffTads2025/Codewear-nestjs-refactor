import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Product } from './product.model.js';
import { ProductSize } from './product-size.model.js';
import { Promotion } from './promotion.model.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [SequelizeModule.forFeature([Product, ProductSize, Promotion])],
  controllers: [ProductsController],
  providers: [ProductsService, RolesGuard],
})
export class ProductsModule {}
