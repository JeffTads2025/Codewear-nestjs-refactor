import { afterEach, describe, expect, it, vi } from 'vitest';
import { Order } from './orders/order.model.js';
import { OrderEventPublisher } from './events/order-event-publisher.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { OrderItem } from './orders/order-item.model.js';
import { Product } from './orders/product.model.js';
import { Cart } from './cart/cart.model.js';
import { Sequelize } from 'sequelize';

afterEach(() => vi.restoreAllMocks());

describe('ServiceOrdersService', () => {
  const createService = () => new ServiceOrdersService(
    Order,
    OrderItem,
    Cart,
    Product,
    {} as Sequelize,
    { publishOrderCreated: vi.fn() } as unknown as OrderEventPublisher,
  );

  it('creates an order and publishes its event', async () => {
    const order = { id: 12 } as Order;
    vi.spyOn(Order, 'create').mockResolvedValue(order);
    const events = {
      publishOrderCreated: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderEventPublisher;
    const service = new ServiceOrdersService(
      Order,
      OrderItem,
      Cart,
      Product,
      {} as Sequelize,
      events,
    );

    await expect(
      service.create(
        { totalValue: 30, paymentMethod: 'pix', address: 'Rua 1' },
        5,
      ),
    ).resolves.toEqual({ message: 'Pedido criado com sucesso', order });

    expect(Order.create).toHaveBeenCalledWith({
      totalValue: 30,
      paymentMethod: 'pix',
      address: 'Rua 1',
      userId: 5,
    });
    expect(events.publishOrderCreated).toHaveBeenCalledWith(12);
  });

  it('lists only the authenticated user orders', async () => {
    const findAndCountAll = vi.spyOn(Order, 'findAndCountAll')
      .mockResolvedValue({ count: 0, rows: [] });

    await createService().listOrders(15);

    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 15 } }),
    );
  });

  it('lists only the authenticated user cart items', async () => {
    const findAll = vi.spyOn(Cart, 'findAll').mockResolvedValue([]);

    await createService().listCart(15);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 15 } }),
    );
  });
});
