import { afterEach, describe, expect, it, vi } from 'vitest';
import { Order } from './orders/order.model.js';
import { OrderEventPublisher } from './events/order-event-publisher.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { OrderItem } from './orders/order-item.model.js';
import { Cart } from './cart/cart.model.js';
import { Sequelize } from 'sequelize';
import { CatalogInternalClient } from './catalog-internal.client.js';
import { NotFoundException } from '@nestjs/common';

afterEach(() => vi.restoreAllMocks());

describe('ServiceOrdersService', () => {
  const events = {
    publishOrderCreated: vi.fn().mockResolvedValue(undefined),
  } as unknown as OrderEventPublisher;
  const catalog = {
    getUser: vi.fn().mockResolvedValue({ id: 5, name: 'Cliente', address: 'Rua 1' }),
    getProduct: vi.fn().mockResolvedValue({ id: 8, name: 'Camiseta' }),
    reserve: vi.fn().mockImplementation(async (input) => ({
      ...input,
      productName: 'Camiseta',
      productImageUrl: '/camiseta.jpg',
      unitPrice: 15,
    })),
    release: vi.fn().mockResolvedValue(undefined),
  } as unknown as CatalogInternalClient;

  const createService = () => new ServiceOrdersService(
    Order,
    OrderItem,
    Cart,
    {} as Sequelize,
    events,
    catalog,
  );

  it('creates an order and publishes its event', async () => {
    const order = { id: 12 } as Order;
    vi.spyOn(Order, 'create').mockResolvedValue(order);

    await expect(
      createService().create(
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
      .mockResolvedValue({ count: [], rows: [] });

    await createService().listOrders(15);

    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 15 } }),
    );
  });

  it('lists only the authenticated user cart items', async () => {
    const findAll = vi.spyOn(Cart, 'findAll').mockResolvedValue([
      {
        productId: 8,
        get: () => ({ productId: 8 }),
      } as Cart,
    ]);

    await expect(createService().listCart(15)).resolves.toEqual({
      items: [{
        productId: 8,
        Product: { id: 8, name: 'Camiseta' },
      }],
    });

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 15 } }),
    );
  });

  it('removes unavailable products and returns an empty cart', async () => {
    vi.spyOn(Cart, 'findAll').mockResolvedValue([{
      id: 7,
      productId: 39,
      get: () => ({ id: 7, productId: 39 }),
    } as Cart]);
    vi.spyOn(catalog, 'getProduct').mockRejectedValueOnce(
      new NotFoundException('Produto não encontrado'),
    );
    const destroy = vi.spyOn(Cart, 'destroy').mockResolvedValue(1);

    await expect(createService().listCart(15)).resolves.toEqual({ items: [] });
    expect(destroy).toHaveBeenCalledWith({ where: { id: 7, userId: 15 } });
  });

  it('reserves live catalog stock and stores a product snapshot at checkout', async () => {
    const transaction = {
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      finished: null,
    };
    const order = { id: 25 } as Order;
    vi.spyOn(Cart, 'findAll').mockResolvedValue([{
      productId: 8,
      quantity: 2,
      size: 'M',
    } as Cart]);
    vi.spyOn(Cart, 'destroy').mockResolvedValue(1);
    vi.spyOn(Order, 'create').mockResolvedValue(order);
    const createItem = vi.spyOn(OrderItem, 'create').mockResolvedValue({} as OrderItem);
    const database = {
      transaction: vi.fn().mockResolvedValue(transaction),
    } as unknown as Sequelize;
    const service = new ServiceOrdersService(
      Order,
      OrderItem,
      Cart,
      database,
      events,
      catalog,
    );

    await expect(
      service.checkout({ paymentMethod: 'pix', address: 'Rua 1' }, 5),
    ).resolves.toEqual({
      message: 'Compra realizada com sucesso',
      orderId: 25,
    });

    expect(catalog.reserve).toHaveBeenCalledWith({
      productId: 8,
      quantity: 2,
      size: 'M',
    });
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalValue: 30, userId: 5 }),
      { transaction },
    );
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 8,
        productName: 'Camiseta',
        productImageUrl: '/camiseta.jpg',
        priceAtPurchase: 15,
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(events.publishOrderCreated).toHaveBeenCalledWith(25);
  });

  it('restores reserved inventory when saving an order item fails', async () => {
    const transaction = {
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      finished: null,
    };
    vi.spyOn(Cart, 'findAll').mockResolvedValue([{
      productId: 8,
      quantity: 2,
      size: null,
    } as Cart]);
    vi.spyOn(Order, 'create').mockResolvedValue({ id: 26 } as Order);
    vi.spyOn(OrderItem, 'create').mockRejectedValue(new Error('write failed'));
    const database = {
      transaction: vi.fn().mockResolvedValue(transaction),
    } as unknown as Sequelize;
    const service = new ServiceOrdersService(
      Order,
      OrderItem,
      Cart,
      database,
      events,
      catalog,
    );

    await expect(
      service.checkout({ paymentMethod: 'pix', address: 'Rua 1' }, 5),
    ).rejects.toMatchObject({ status: 500 });

    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(catalog.release).toHaveBeenCalledWith({
      productId: 8,
      quantity: 2,
      size: null,
    });
  });
});
