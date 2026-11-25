import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

const originalJwtSecret = process.env.JWT_SECRET;
afterEach(() => {
  vi.restoreAllMocks();
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function createGuard(role: string) {
  process.env.JWT_SECRET = 'test-secret';
  const handler = vi.fn();
  Roles('admin')(handler);
  const request = {
    headers: {
      authorization: `Bearer ${jwt.sign({ id: 8, role }, 'test-secret')}`,
    },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = new Reflector();
  const query = vi.fn().mockResolvedValue([{ isActive: true }]);
  const database = {
    query,
  } as unknown as Sequelize;

  return {
    guard: new RolesGuard(reflector, database),
    context,
    query,
  };
}

describe('RolesGuard', () => {
  it('allows an active admin with a signed admin role', async () => {
    const { guard, context, query } = createGuard('admin');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      'SELECT isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [8], type: QueryTypes.SELECT },
    );
  });

  it('forbids an active client from admin operations', async () => {
    const { guard, context } = createGuard('client');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
