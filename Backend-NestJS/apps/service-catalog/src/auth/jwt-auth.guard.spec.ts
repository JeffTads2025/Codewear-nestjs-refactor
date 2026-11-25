import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JwtAuthGuard,
  type AuthenticatedUserRequest,
} from './jwt-auth.guard.js';

const originalJwtSecret = process.env.JWT_SECRET;
afterEach(() => {
  vi.restoreAllMocks();
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function createGuard(authorization?: string) {
  process.env.JWT_SECRET = 'test-secret';
  const request = { headers: { authorization } } as AuthenticatedUserRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const query = vi.fn().mockResolvedValue([{
    id: 42,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    isActive: true,
  }]);
  const database = { query } as unknown as Sequelize;

  return {
    guard: new JwtAuthGuard(database),
    context,
    query,
    request,
  };
}

describe('JwtAuthGuard', () => {
  it('uses verified identity claims and validates the user against the database', async () => {
    const authorization = `Bearer ${jwt.sign({
      id: 42,
      email: 'token@example.com',
      name: 'Token Admin',
    }, 'test-secret')}`;
    const { guard, context, query, request } = createGuard(authorization);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      'SELECT id, email, name, role, isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [42], type: QueryTypes.SELECT },
    );
    expect(request.user).toEqual({
      id: 42,
      email: 'token@example.com',
      name: 'Token Admin',
      role: 'admin',
    });
  });

  it('rejects requests without a bearer token', async () => {
    const { guard, context } = createGuard();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
