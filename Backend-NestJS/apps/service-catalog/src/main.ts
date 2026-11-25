import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { configureHttp } from '../../../libs/configure-http.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().disable('etag');
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  configureHttp(app, 'service-catalog');
  app.enableCors({ origin: '*', credentials: true });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
