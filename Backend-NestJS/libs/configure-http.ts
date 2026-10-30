import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter.js';

export function configureHttp(app: INestApplication, serviceName: string) {
  const logger = new Logger(serviceName);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      logger.log(
        `${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms`,
      );
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
