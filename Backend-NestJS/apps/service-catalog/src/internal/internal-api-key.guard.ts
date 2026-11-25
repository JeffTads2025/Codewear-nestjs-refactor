import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredKey = process.env.INTERNAL_API_KEY;
    const suppliedKey = context
      .switchToHttp()
      .getRequest<Request>()
      .header('X-Internal-Secret');

    if (!configuredKey || !suppliedKey) {
      throw new UnauthorizedException('Credencial interna inválida');
    }

    const expected = Buffer.from(configuredKey);
    const actual = Buffer.from(suppliedKey);
    if (
      expected.length !== actual.length
      || !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException('Credencial interna inválida');
    }
    return true;
  }
}
