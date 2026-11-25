import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import type { AuthenticatedUserRequest } from './jwt-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      throw new ForbiddenException('Nenhum papel autorizado configurado');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Token de autenticação obrigatório');
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Sem permissão para esta operação');
    }
    return true;
  }
}
