import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redisClient = vi.hoisted(() => ({
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue(undefined),
  isOpen: true,
}));

vi.mock('redis', () => ({
  createClient: () => redisClient,
}));

import { OrderEventPublisher } from './order-event-publisher.js';

afterEach(() => vi.restoreAllMocks());

describe('OrderEventPublisher', () => {
  it('publishes the order_created payload and logs it', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const publisher = new OrderEventPublisher();

    await publisher.publishOrderCreated(42);

    const payload = JSON.stringify({ event: 'order_created', orderId: 42 });
    expect(redisClient.publish).toHaveBeenCalledWith('order_created', payload);
    expect(log).toHaveBeenCalledWith(
      `[Pub/Sub] Evento publicado: order_created payload=${payload}`,
    );
  });
});
