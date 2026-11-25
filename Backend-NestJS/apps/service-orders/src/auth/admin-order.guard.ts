import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { CatalogInternalClient } from '../catalog-internal.client.js';

interface AdminTokenPayload extends jwt.JwtPayload {
  id?: unknown;
  role?: unknown;
}

export interface AdminRequest extends Request {
  userId: number;
}

@Injectable()
export class AdminOrderGuard implements CanActivate {
  constructor(private readonly catalog: CatalogInternalClient) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação obrigatório');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET não configurado');
    }

    let payload: AdminTokenPayload;
    try {
      const verified = jwt.verify(
        authorization.slice('Bearer '.length).trim(),
        secret,
      );
      if (typeof verified !== 'object' || verified === null) {
        throw new Error('Invalid JWT payload');
      }
      payload = verified;
    } catch {
      throw new UnauthorizedException('Sessão expirada ou inválida');
    }

    if (
      typeof payload.id !== 'number'
      || !Number.isInteger(payload.id)
      || typeof payload.role !== 'string'
    ) {
      throw new UnauthorizedException('Token inválido');
    }
    if (payload.role !== 'admin') {
      throw new ForbiddenException('Acesso exclusivo para administradores');
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
