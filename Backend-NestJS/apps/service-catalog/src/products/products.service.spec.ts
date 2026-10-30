import { afterEach, describe, expect, it, vi } from 'vitest';
import { Product } from './product.model.js';
import { Promotion } from './promotion.model.js';
import { ProductsService } from './products.service.js';
import { RedisService } from '../redis/redis.service.js';

function createRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    deletePattern: vi.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;
}

afterEach(() => vi.restoreAllMocks());

describe('ProductsService', () => {
  it('returns paginated visible products with the active store promotion', async () => {
    const product = { promotions: [] } as Product;
    const storePromotion = {
      discountPercentage: 10,
      isActive: true,
      validFrom: null,
      validUntil: null,
    } as Promotion;

    vi.spyOn(Product, 'findAndCountAll').mockResolvedValue({
      count: 1,
      rows: [product],
    });
    vi.spyOn(Promotion, 'findOne').mockResolvedValue(storePromotion);
    const redis = createRedisMock();

    const result = await new ProductsService(Product, Promotion, redis).list('2', '5');

    expect(result).toEqual({ products: [product], totalPages: 1, total: 1 });
    expect(product.promotions).toContain(storePromotion);
    expect(Product.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, offset: 5, where: { isVisible: true } }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      'catalog:products:page:2:limit:5',
      JSON.stringify(result),
      expect.any(Number),
    );
  });

  it('serves a cached catalog response without querying the database', async () => {
    const cached = JSON.stringify({ products: [], totalPages: 0, total: 0 });
    const redis = createRedisMock();
    const databaseQuery = vi.spyOn(Product, 'findAndCountAll');
    vi.mocked(redis.get).mockResolvedValue(cached);

    await expect(new ProductsService(Product, Promotion, redis).list()).resolves.toEqual(
      JSON.parse(cached),
    );
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('invalidates cached catalog pages after creating a product', async () => {
    const createdProduct = { id: 1 } as Product;
    vi.spyOn(Product, 'create').mockResolvedValue(createdProduct);
    const redis = createRedisMock();

    await new ProductsService(Product, Promotion, redis).create({
      name: 'Test',
      price: 10,
      stock: 2,
    });

    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
  });

  it('invalidates cached catalog pages after updating a product', async () => {
    const product = { update: vi.fn().mockResolvedValue(undefined) } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const redis = createRedisMock();

    await new ProductsService(Product, Promotion, redis).update(1, { stock: 5 });

    expect(product.update).toHaveBeenCalledWith({ stock: 5 });
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
  });

  it('deletes a product and invalidates cached catalog pages', async () => {
    const product = { update: vi.fn().mockResolvedValue(undefined) } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const redis = createRedisMock();

    await expect(new ProductsService(Product, Promotion, redis).delete(1)).resolves.toEqual({
      message: 'Produto excluído com sucesso',
    });

    expect(product.update).toHaveBeenCalledWith({ isVisible: false });
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
  });

  it('updates stock through the shared update path and invalidates the catalog', async () => {
    const product = { update: vi.fn().mockResolvedValue(undefined) } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const redis = createRedisMock();

    await new ProductsService(Product, Promotion, redis).updateStock(1, { stock: 7 });

    expect(product.update).toHaveBeenCalledWith({ stock: 7 });
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
  });
});
