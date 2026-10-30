import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { User } from './user.model.js';

interface TokenPayload extends jwt.JwtPayload {
  id?: unknown;
}

export interface AuthenticatedUserRequest extends Request {
  userId: number;
}

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(@InjectModel(User) private readonly users: typeof User) {}

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

    const user = await this.users.findByPk(payload.id, {
      attributes: ['id', 'isActive'],
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Conta indisponível');
    }

    request.userId = user.id;
    return true;
  }
}
