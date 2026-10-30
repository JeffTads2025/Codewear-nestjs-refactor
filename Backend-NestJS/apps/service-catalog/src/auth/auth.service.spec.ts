import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { User } from './user.model.js';

const originalJwtSecret = process.env.JWT_SECRET;
afterEach(() => {
  vi.restoreAllMocks();
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe('AuthService', () => {
  it('authenticates a user and returns a signed token without the password', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const user = {
      id: 8,
      name: 'Test User',
      email: 'test@example.com',
      cpf: '12345678901',
      password: await bcrypt.hash('strong-password', 4),
      role: 'client',
      phone: '123',
      address: 'Street 1',
      avatarUrl: null,
      isActive: true,
    } as unknown as User;
    vi.spyOn(User, 'findOne').mockResolvedValue(user);

    const result = await new AuthService(User).login({
      email: ' TEST@example.com ',
      password: 'strong-password',
    });

    expect(result.user).toEqual({
      id: 8,
      name: 'Test User',
      email: 'test@example.com',
      cpf: '12345678901',
      role: 'client',
      phone: '123',
      address: 'Street 1',
      avatarUrl: null,
    });
    expect(jwt.verify(result.token, 'test-secret')).toMatchObject({
      id: 8,
      role: 'client',
    });
    expect(result.user).not.toHaveProperty('password');
  });

  it('rejects invalid credentials', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    await expect(
      new AuthService(User).login({
        email: 'missing@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
