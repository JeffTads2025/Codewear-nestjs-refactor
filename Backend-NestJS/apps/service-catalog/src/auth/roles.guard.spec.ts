import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

afterEach(() => vi.restoreAllMocks());

function createGuard(role?: string) {
  const handler = vi.fn();
  Roles('admin')(handler);
  const request = {
    user: role ? { id: 8, email: 'user@example.com', name: 'User', role } : undefined,
  };
  const context = {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return {
    guard: new RolesGuard(new Reflector()),
    context,
  };
}

describe('RolesGuard', () => {
  it('allows an authenticated admin', async () => {
    const { guard, context } = createGuard('admin');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('forbids an authenticated client', async () => {
    const { guard, context } = createGuard('client');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a request without an authenticated user', async () => {
    const { guard, context } = createGuard();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
