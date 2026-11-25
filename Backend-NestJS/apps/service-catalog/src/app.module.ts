import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductsModule } from './products/products.module.js';
import { Product } from './products/product.model.js';
import { ProductSize } from './products/product-size.model.js';
import { Promotion } from './products/promotion.model.js';
import { RedisModule } from './redis/redis.module.js';
import { OrdersEventSubscriber } from './events/orders-event-subscriber.js';
import { AuthModule } from './auth/auth.module.js';
import { User } from './auth/user.model.js';
import { InternalModule } from './internal/internal.module.js';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'codewear_catalog',
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASS ?? '',
      models: [Product, ProductSize, Promotion, User],
      autoLoadModels: true,
      synchronize: false,
      logging: false,
    }),
    RedisModule,
    AuthModule,
    ProductsModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [AppService, OrdersEventSubscriber],
})
export class AppModule {}
