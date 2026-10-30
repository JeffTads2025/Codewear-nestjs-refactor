import { ExecutionContext } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderAuthGuard } from './order-auth.guard.js';

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
    const query = vi.fn().mockResolvedValue([{ isActive: true }]);
    const database = { query } as unknown as Sequelize;

    await expect(new OrderAuthGuard(database).canActivate(context))
      .resolves.toBe(true);

    expect(request).toHaveProperty('userId', 15);
    expect(query).toHaveBeenCalledWith(
      'SELECT isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [15], type: QueryTypes.SELECT },
    );
  });
});
