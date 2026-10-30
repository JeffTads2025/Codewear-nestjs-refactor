import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersEventSubscriber } from './orders-event-subscriber.js';

afterEach(() => vi.restoreAllMocks());

describe('OrdersEventSubscriber', () => {
  it('logs a received order_created event', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const subscriber = new OrdersEventSubscriber();

    subscriber.receiveMessage(
      JSON.stringify({ event: 'order_created', orderId: 42 }),
    );

    expect(log).toHaveBeenCalledWith(
      '[Pub/Sub] Evento recebido: order_created payload={"event":"order_created","orderId":42}',
    );
  });
});
