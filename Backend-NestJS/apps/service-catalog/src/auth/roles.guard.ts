import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator.js';

interface TokenPayload extends jwt.JwtPayload {
  id?: unknown;
  role?: unknown;
}

interface UserRow {
  isActive: boolean | number;
}

interface AuthorizationRequest extends Request {
  userId: number;
  role: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectConnection() private readonly database: Sequelize,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      throw new ForbiddenException('Nenhum papel autorizado configurado');
    }

    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
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

    if (
      typeof payload.id !== 'number'
      || !Number.isInteger(payload.id)
      || typeof payload.role !== 'string'
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    const users = await this.database.query<UserRow>(
      'SELECT isActive FROM users WHERE id = ? LIMIT 1',
      { replacements: [payload.id], type: QueryTypes.SELECT },
    );
    if (!users[0] || !users[0].isActive) {
      throw new UnauthorizedException('Conta indisponível');
    }

    if (!requiredRoles.includes(payload.role)) {
      throw new ForbiddenException('Sem permissão para esta operação');
    }

    request.userId = payload.id;
    request.role = payload.role;
    return true;
  }
}
