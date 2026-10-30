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
import { RolesGuard } from './roles.guard.js';

@Controller('admin')
@UseGuards(RolesGuard)
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
      return { users: rows, total: count };
    } catch {
      throw new InternalServerErrorException('Não foi possível carregar clientes');
    }
  }
}
