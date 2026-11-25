import { afterEach, describe, expect, it, vi } from 'vitest';
import { Product } from './product.model.js';
import { ProductSize } from './product-size.model.js';
import { Promotion } from './promotion.model.js';
import { ProductsService } from './products.service.js';
import { RedisService } from '../redis/redis.service.js';
import { Sequelize } from 'sequelize';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProductDto } from './dto/update-product.dto.js';

function createDatabaseMock() {
  return {
    transaction: vi.fn().mockResolvedValue({
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      finished: null,
    }),
    query: vi.fn().mockResolvedValue([[], 1]),
  } as unknown as Sequelize;
}

function createRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    deletePattern: vi.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;
}

function createService(
  redis = createRedisMock(),
  database = createDatabaseMock(),
) {
  return new ProductsService(
    Product,
    ProductSize,
    Promotion,
    database,
    redis,
  );
}

const admin = {
  id: 42,
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
};

afterEach(() => vi.restoreAllMocks());

describe('ProductsService', () => {
  it('accepts image URLs, sizes, and promotions in product updates', async () => {
    const input = plainToInstance(UpdateProductDto, {
      image_url: 'https://example.com/shirt.jpg',
      sizes: [{ size: 'M', stock: 5 }],
      promotions: [{
        discountPercentage: 10,
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        isActive: true,
      }],
    });

    await expect(validate(input, {
      whitelist: true,
      forbidNonWhitelisted: true,
    })).resolves.toEqual([]);
  });

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

    const result = await createService(redis).list('2', '5');

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

    await expect(createService(redis).list()).resolves.toEqual(
      JSON.parse(cached),
    );
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('finds a product by ID with sizes and promotions', async () => {
    const product = { id: 8 } as Product;
    const findByPk = vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const service = createService();

    await expect(service.findById(8)).resolves.toBe(product);
    expect(findByPk).toHaveBeenCalledWith(8, {
      include: [
        { model: expect.any(Function), as: 'sizes' },
        { model: expect.any(Function), as: 'promotions' },
      ],
    });
  });

  it('throws NotFoundException when a product ID does not exist', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue(null);
    const service = createService();

    await expect(service.findById(404)).rejects.toMatchObject({
      status: 404,
      response: { message: 'Produto não encontrado' },
    });
  });

  it('invalidates cached catalog pages after creating a product', async () => {
    const createdProduct = { id: 1, name: 'Test Product' } as Product;
    vi.spyOn(Product, 'create').mockResolvedValue(createdProduct);
    vi.spyOn(Product, 'findByPk').mockResolvedValue(createdProduct);
    const redis = createRedisMock();
    const database = createDatabaseMock();

    await createService(redis, database).create({
      name: 'Test',
      price: 10,
      stock: 2,
    }, admin);

    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.objectContaining({
        replacements: [
          admin.id,
          admin.name,
          'CREATE_PRODUCT',
          "Criou o produto 'Test Product' (ID 1). Autor: Admin User <admin@example.com> (ID 42).",
        ],
        transaction: expect.anything(),
      }),
    );
  });

  it('invalidates cached catalog pages after updating a product', async () => {
    const product = {
      id: 1,
      name: 'Test Product',
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const replaceSizes = vi.spyOn(ProductSize, 'destroy').mockResolvedValue(0);
    const createSizes = vi.spyOn(ProductSize, 'bulkCreate').mockResolvedValue([]);
    const replacePromotions = vi.spyOn(Promotion, 'destroy').mockResolvedValue(0);
    const createPromotions = vi.spyOn(Promotion, 'bulkCreate').mockResolvedValue([]);
    const redis = createRedisMock();
    const database = createDatabaseMock();

    await createService(redis, database).update(1, {
      stock: 5,
      image_url: 'https://example.com/shirt.jpg',
      sizes: [{ size: 'M', stock: 5 }],
      promotions: [{
        discountPercentage: 10,
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        isActive: true,
      }],
    }, admin);

    expect(product.update).toHaveBeenCalledWith(
      { stock: 5, image_url: 'https://example.com/shirt.jpg' },
      { transaction: expect.anything() },
    );
    expect(replaceSizes).toHaveBeenCalledWith({
      where: { productId: 1 },
      transaction: expect.anything(),
    });
    expect(createSizes).toHaveBeenCalledWith(
      [{ size: 'M', stock: 5, productId: 1 }],
      { transaction: expect.anything() },
    );
    expect(replacePromotions).toHaveBeenCalledWith({
      where: { productId: 1 },
      transaction: expect.anything(),
    });
    expect(createPromotions).toHaveBeenCalledWith(
      [{
        discountPercentage: 10,
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        isActive: true,
        productId: 1,
        code: null,
      }],
      { transaction: expect.anything() },
    );
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.objectContaining({
        replacements: [
          admin.id,
          admin.name,
          'UPDATE_PRODUCT',
          "Editou o produto 'Test Product' (ID 1). Autor: Admin User <admin@example.com> (ID 42).",
        ],
        transaction: expect.anything(),
      }),
    );
  });

  it('deletes a product and invalidates cached catalog pages', async () => {
    const product = {
      id: 1,
      name: 'Test Product',
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const redis = createRedisMock();
    const database = createDatabaseMock();

    await expect(createService(redis, database).delete(1, admin)).resolves.toEqual({
      message: 'Produto excluído com sucesso',
    });

    expect(product.update).toHaveBeenCalledWith(
      { isVisible: false },
      { transaction: expect.anything() },
    );
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.objectContaining({
        replacements: [
          admin.id,
          admin.name,
          'DELETE_PRODUCT',
          "Excluiu o produto 'Test Product' (ID 1) da vitrine. Autor: Admin User <admin@example.com> (ID 42).",
        ],
        transaction: expect.anything(),
      }),
    );
  });

  it('updates stock through the shared update path and invalidates the catalog', async () => {
    const product = { id: 1, update: vi.fn().mockResolvedValue(undefined) } as unknown as Product;
    vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
    const redis = createRedisMock();

    await createService(redis).updateStock(1, { stock: 7 }, admin);

    expect(product.update).toHaveBeenCalledWith(
      { stock: 7 },
      { transaction: expect.anything() },
    );
    expect(redis.deletePattern).toHaveBeenCalledWith('catalog:products:*');
  });
});
