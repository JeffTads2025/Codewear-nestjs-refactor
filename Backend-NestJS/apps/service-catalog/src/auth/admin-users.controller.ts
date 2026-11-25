import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model.js';
import { Roles } from './roles.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(@InjectModel(User) private readonly users: typeof User) {}

  @Get('users')
  async listUsers(@Query('limit') limitInput?: string) {
    const parsedLimit = Number(limitInput ?? 50);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 50;

    try {
      const { count, rows } = await this.users.findAndCountAll({
        where: { role: 'client' },
        attributes: [
          'id',
          'name',
          'email',
          'cpf',
          'phone',
          'address',
          'role',
          'isActive',
          'createdAt',
        ],
        order: [['createdAt', 'DESC']],
        limit,
      });
      const total = count;
      return { users: rows, total };
    } catch {
      throw new InternalServerErrorException('Não foi possível carregar clientes');
    }
  }
}
