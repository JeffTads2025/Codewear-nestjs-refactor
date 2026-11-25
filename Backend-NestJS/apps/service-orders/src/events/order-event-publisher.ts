import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';

export const ORDER_CREATED_CHANNEL = 'order_created';

@Injectable()
export class OrderEventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderEventPublisher.name);
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  });

  constructor() {
    this.client.on('error', (error) =>
      this.logger.error('Redis publisher connection error', error),
    );
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('[Pub/Sub] Publicador conectado ao Redis');
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }

  async publishOrderCreated(orderId: number) {
    const payload = { event: ORDER_CREATED_CHANNEL, orderId };
    await this.client.publish(
      ORDER_CREATED_CHANNEL,
      JSON.stringify(payload),
    );
    this.logger.log(
      `[Pub/Sub] Evento publicado: order_created payload=${JSON.stringify(payload)}`,
    );
  }
}
