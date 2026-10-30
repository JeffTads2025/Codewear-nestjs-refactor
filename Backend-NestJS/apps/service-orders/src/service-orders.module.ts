import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { Order } from './orders/order.model.js';
import { OrderEventPublisher } from './events/order-event-publisher.js';
import { OrderAuthGuard } from './auth/order-auth.guard.js';
import { OrderItem } from './orders/order-item.model.js';
import { Product } from './orders/product.model.js';
import { Cart } from './cart/cart.model.js';
import { CartController } from './cart/cart.controller.js';
import { CheckoutController } from './orders/checkout.controller.js';
import { User } from './orders/user.model.js';
import { AdminOrdersController } from './orders/admin-orders.controller.js';
import { AdminOrderGuard } from './auth/admin-order.guard.js';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'codewear_db',
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASS ?? '',
      models: [Order, OrderItem, Cart, Product, User],
      autoLoadModels: true,
      synchronize: false,
      logging: false,
    }),
    SequelizeModule.forFeature([Order, OrderItem, Cart, Product, User]),
  ],
  controllers: [
    ServiceOrdersController,
    CartController,
    CheckoutController,
    AdminOrdersController,
  ],
  providers: [
    ServiceOrdersService,
    OrderEventPublisher,
    OrderAuthGuard,
    AdminOrderGuard,
  ],
})
export class ServiceOrdersModule {}
