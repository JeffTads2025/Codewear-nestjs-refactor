import { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';

const originalKey = process.env.INTERNAL_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY;
  else process.env.INTERNAL_API_KEY = originalKey;
});

describe('InternalApiKeyGuard', () => {
  it('accepts only the configured internal secret', () => {
    process.env.INTERNAL_API_KEY = 'test-internal-key';
    const request = {
      header: (name: string) => name === 'X-Internal-Secret'
        ? 'test-internal-key'
        : undefined,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(new InternalApiKeyGuard().canActivate(context)).toBe(true);
  });

  it('rejects a missing or incorrect internal secret', () => {
    process.env.INTERNAL_API_KEY = 'expected-key';
    const request = { header: () => 'wrong-key' };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(() => new InternalApiKeyGuard().canActivate(context)).toThrow(
      'Credencial interna inválida',
    );
  });
});
