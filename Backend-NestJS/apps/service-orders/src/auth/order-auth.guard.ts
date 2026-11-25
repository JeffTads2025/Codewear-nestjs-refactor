import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

interface TokenPayload {
  id: number;
}

interface UserRow {
  isActive: boolean | number;
}

export interface AuthenticatedRequest extends Request {
  userId: number;
}

@Injectable()
export class OrderAuthGuard implements CanActivate {
  constructor(@InjectConnection() private readonly database: Sequelize) {}

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

    const users = await this.database.query<UserRow>(
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
