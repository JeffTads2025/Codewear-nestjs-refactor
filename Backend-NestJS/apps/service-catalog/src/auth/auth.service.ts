import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { LoginDto } from './login.dto.js';
import { User } from './user.model.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@InjectModel(User) private readonly users: typeof User) {}

  async login(input: LoginDto) {
    try {
      const email = input.email.trim().toLowerCase();
      const user = await this.users.findOne({
        where: { email },
        attributes: [
          'id',
          'name',
          'email',
          'cpf',
          'password',
          'role',
          'phone',
          'address',
          'avatarUrl',
          'isActive',
        ],
      });

      if (!user || !(await this.passwordMatches(input.password, user.password))) {
        throw new UnauthorizedException('Usuário ou senha inválidos');
      }
      if (!user.isActive) {
        throw new ForbiddenException('Esta conta está inativa.');
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new InternalServerErrorException('JWT_SECRET não configurado');
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, role: user.role },
        secret,
        { expiresIn: '1d' },
      );

      this.logger.log(`POST /login succeeded for user #${user.id}`);
      return {
        message: 'Login realizado!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          role: user.role,
          phone: user.phone,
          address: user.address,
          avatarUrl: user.avatarUrl,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException
        || error instanceof ForbiddenException
        || error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error('Failed to authenticate user', error);
      throw new InternalServerErrorException('Erro ao processar o login.');
    }
  }

  private async passwordMatches(password: string, hash: string) {
    if (await bcrypt.compare(password, hash)) return true;
    const trimmedPassword = password.trim();
    return trimmedPassword !== password
      && bcrypt.compare(trimmedPassword, hash);
  }
}
