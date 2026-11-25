import { ExecutionContext } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderAuthGuard } from './order-auth.guard.js';
import { CatalogInternalClient } from '../catalog-internal.client.js';

const originalJwtSecret = process.env.JWT_SECRET;
afterEach(() => {
  vi.restoreAllMocks();
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe('OrderAuthGuard', () => {
  it('verifies the bearer token and attaches its user ID to the request', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const request = {
      headers: {
        authorization: `Bearer ${jwt.sign({ id: 15 }, 'test-secret')}`,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const catalog = {
      getUser: vi.fn().mockResolvedValue({ id: 15, name: 'Cliente' }),
    } as unknown as CatalogInternalClient;

    await expect(new OrderAuthGuard(catalog).canActivate(context))
      .resolves.toBe(true);

    expect(request).toHaveProperty('userId', 15);
    expect(catalog.getUser).toHaveBeenCalledWith(15);
  });
});
