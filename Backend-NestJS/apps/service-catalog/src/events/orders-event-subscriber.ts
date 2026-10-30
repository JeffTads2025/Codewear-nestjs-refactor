import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';

interface OrderCreatedEvent {
  event: 'order_created';
  orderId: number;
}

@Injectable()
export class OrdersEventSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersEventSubscriber.name);
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  });

  constructor() {
    this.client.on('error', (error) =>
      this.logger.error('Redis subscriber connection error', error),
    );
  }

  async onModuleInit() {
    await this.client.connect();
    await this.client.subscribe('order_created', (message) =>
      this.receiveMessage(message),
    );
    this.logger.log('[Pub/Sub] Assinatura ativa no canal order_created');
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }

  receiveMessage(message: string) {
    let event: OrderCreatedEvent;
    try {
      event = JSON.parse(message) as OrderCreatedEvent;
    } catch (error) {
      this.logger.error('[Pub/Sub] Mensagem order_created inválida', error);
      return;
    }

    if (
      !event
      || event.event !== 'order_created'
      || !Number.isInteger(event.orderId)
    ) {
      this.logger.error('[Pub/Sub] Payload order_created inválido');
      return;
    }

    this.logger.log(
      `[Pub/Sub] Evento recebido: order_created payload=${JSON.stringify(event)}`,
    );
  }
}
