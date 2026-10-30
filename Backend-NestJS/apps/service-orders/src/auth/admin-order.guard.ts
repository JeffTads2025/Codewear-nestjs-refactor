import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

interface AdminTokenPayload extends jwt.JwtPayload {
  id?: unknown;
  role?: unknown;
}

interface ActiveUserRow {
  isActive: boolean | number;
}

export interface AdminRequest extends Request {
  userId: number;
}

@Injectable()
export class AdminOrderGuard implements CanActivate {
  constructor(@InjectConnection() private readonly database: Sequelize) {}

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

    const users = await this.database.query<ActiveUserRow>(
      'SELECT isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [payload.id], type: QueryTypes.SELECT },
    );
    if (!users[0] || !users[0].isActive) {
      throw new UnauthorizedException('Conta indisponível');
    }

    request.userId = payload.id;
    return true;
  }
}
