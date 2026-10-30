import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserAuthGuard, type AuthenticatedUserRequest } from './user-auth.guard.js';
import { UpdateProfileDto } from './update-profile.dto.js';
import { User } from './user.model.js';

@Controller('users')
@UseGuards(UserAuthGuard)
export class UserProfileController {
  constructor(@InjectModel(User) private readonly users: typeof User) {}

  @Get('profile')
  async getProfile(
    @Req() request: AuthenticatedUserRequest,
  ): Promise<User> {
    try {
      const user = await this.users.findByPk(request.userId, {
        attributes: [
          'id',
          'name',
          'email',
          'cpf',
          'phone',
          'address',
          'role',
          'avatarUrl',
        ],
      });
      if (!user) throw new NotFoundException('Usuário não encontrado');
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Não foi possível carregar o perfil');
    }
  }

  @Put('profile')
  async updateProfile(
    @Req() request: AuthenticatedUserRequest,
    @Body() input: UpdateProfileDto,
  ): Promise<User> {
    try {
      const user = await this.users.findByPk(request.userId);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      await user.update(input);
      return this.getProfile(request);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Não foi possível atualizar o perfil');
    }
  }
}
