import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { CatalogInternalClient } from '../catalog-internal.client.js';

interface TokenPayload {
  id: number;
}

export interface AuthenticatedRequest extends Request {
  userId: number;
}

@Injectable()
export class OrderAuthGuard implements CanActivate {
  constructor(private readonly catalog: CatalogInternalClient) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação obrigatório');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET não configurado');
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(
        authorization.slice('Bearer '.length).trim(),
        secret,
      ) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Sessão expirada ou inválida');
    }
    if (!Number.isInteger(payload.id)) {
      throw new UnauthorizedException('Token inválido');
    }

    try {
      await this.catalog.getUser(payload.id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw new UnauthorizedException('Conta indisponível');
      }
      throw error;
    }

    request.userId = payload.id;
    return true;
  }
}
