import { NestFactory } from '@nestjs/core';
import { ServiceOrdersModule } from './service-orders.module.js';
import { configureHttp } from '../../../libs/configure-http.js';

async function bootstrap() {
  const app = await NestFactory.create(ServiceOrdersModule);
  configureHttp(app, 'service-orders');
  app.enableCors({ origin: '*', credentials: true });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
await bootstrap();
