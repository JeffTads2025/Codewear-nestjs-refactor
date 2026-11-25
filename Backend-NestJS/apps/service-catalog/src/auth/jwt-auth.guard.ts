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

interface TokenPayload extends jwt.JwtPayload {
  id?: unknown;
  name?: unknown;
  email?: unknown;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean | number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedUserRequest extends Request {
  userId: number;
  role: string;
  user: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@InjectConnection() private readonly database: Sequelize) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>();
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

    if (typeof payload.id !== 'number' || !Number.isInteger(payload.id)) {
      throw new UnauthorizedException('Token inválido');
    }

    const users = await this.database.query<UserRow>(
      'SELECT id, email, name, role, isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [payload.id], type: QueryTypes.SELECT },
    );
    const user = users[0];
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Conta indisponível');
    }

    request.userId = user.id;
    request.role = user.role;
    request.user = {
      id: user.id,
      email: typeof payload.email === 'string' && payload.email
        ? payload.email
        : user.email,
      name: typeof payload.name === 'string' && payload.name
        ? payload.name
        : user.name,
      role: user.role,
    };
    return true;
  }
}
