import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { User } from '../auth/user.model.js';
import { Product } from '../products/product.model.js';
import { ProductSize } from '../products/product-size.model.js';
import { Promotion } from '../products/promotion.model.js';
import { RedisService } from '../redis/redis.service.js';
import { InternalService } from './internal.service.js';

afterEach(() => vi.restoreAllMocks());

describe('InternalService', () => {
  it('reserves live stock at the current promotion price and invalidates catalog pages', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };
    const decrement = vi.fn().mockResolvedValue(undefined);
    const product = {
      id: 8,
      name: 'Camiseta',
      price: 100,
      stock: 5,
      image_url: '/camiseta.jpg',
      isVisible: true,
      decrement,
    } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    vi.spyOn(Promotion, 'findAll').mockResolvedValue([{
      discountPercentage: 10,
      isActive: true,
      validFrom: null,
      validUntil: null,
    } as Promotion]);
    vi.spyOn(Promotion, 'findOne').mockResolvedValue(null);
    const invalidateCache = vi.fn().mockImplementation(async () => {
      expect(transaction.commit).toHaveBeenCalledOnce();
    });
    const redis = {
      deletePattern: invalidateCache,
    } as unknown as RedisService;
    const database = {
      transaction: vi.fn().mockResolvedValue(transaction),
    } as unknown as Sequelize;
    const service = new InternalService(
      User,
      Product,
      ProductSize,
      Promotion,
      database,
      redis,
    );

    await expect(service.reserve({
      productId: 8,
      quantity: 2,
      size: null,
    })).resolves.toEqual({
      productId: 8,
      productName: 'Camiseta',
      productImageUrl: '/camiseta.jpg',
      quantity: 2,
      size: null,
      unitPrice: 90,
    });

    expect(decrement).toHaveBeenCalledWith(
      'stock',
      { by: 2, transaction },
    );
    expect(invalidateCache).toHaveBeenCalledWith('catalog:products:*');
    expect(transaction.commit).toHaveBeenCalledOnce();
  });

  it('reads active user details directly without putting them in Redis', async () => {
    const user = {
      id: 5,
      name: 'Cliente',
      address: 'Rua 1',
      isActive: true,
    } as User;
    const findByPk = vi.spyOn(User, 'findByPk').mockResolvedValue(user);
    const getCachedValue = vi.fn();
    const setCachedValue = vi.fn();
    const redis = {
      deletePattern: vi.fn(),
      get: getCachedValue,
      set: setCachedValue,
    } as unknown as RedisService;
    const service = new InternalService(
      User,
      Product,
      ProductSize,
      Promotion,
      {} as Sequelize,
      redis,
    );

    await expect(service.getUser(5)).resolves.toEqual({
      id: 5,
      name: 'Cliente',
      address: 'Rua 1',
    });
    expect(findByPk).toHaveBeenCalledWith(5, {
      attributes: ['id', 'name', 'address', 'isActive'],
    });
    expect(getCachedValue).not.toHaveBeenCalled();
    expect(setCachedValue).not.toHaveBeenCalled();
  });

  it('decrements both the selected size and aggregate product stock', async () => {
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };
    const decrementProduct = vi.fn().mockResolvedValue(undefined);
    const product = {
      id: 8,
      name: 'Camiseta',
      price: 20,
      stock: 5,
      isVisible: true,
      decrement: decrementProduct,
    } as unknown as Product;
    const decrementSize = vi.fn().mockResolvedValue(undefined);
    const size = { stock: 3, decrement: decrementSize } as unknown as ProductSize;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    vi.spyOn(ProductSize, 'findOne').mockResolvedValue(size);
    vi.spyOn(Promotion, 'findAll').mockResolvedValue([]);
    vi.spyOn(Promotion, 'findOne').mockResolvedValue(null);
    const redis = {
      deletePattern: vi.fn().mockResolvedValue(undefined),
    } as unknown as RedisService;
    const service = new InternalService(
      User,
      Product,
      ProductSize,
      Promotion,
      {
        transaction: vi.fn().mockResolvedValue(transaction),
      } as unknown as Sequelize,
      redis,
    );

    await service.reserve({ productId: 8, quantity: 2, size: 'M' });

    expect(decrementSize).toHaveBeenCalledWith(
      'stock',
      { by: 2, transaction },
    );
    expect(decrementProduct).toHaveBeenCalledWith(
      'stock',
      { by: 2, transaction },
    );
  });
});
