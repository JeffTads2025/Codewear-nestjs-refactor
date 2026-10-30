import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

interface AuditLogRow {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  details: string | null;
  createdAt: Date;
}

@Controller('admin')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminAuditController {
  constructor(@InjectConnection() private readonly database: Sequelize) {}

  @Get('logs')
  async listLogs(@Query('limit') limitInput?: string) {
    const parsedLimit = Number(limitInput ?? 50);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 50;

    try {
      const logs = await this.database.query<AuditLogRow>(
        `SELECT id, adminId, adminName, action, details, createdAt
         FROM audit_logs
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`,
        { replacements: [limit], type: QueryTypes.SELECT },
      );
      return { logs };
    } catch {
      throw new InternalServerErrorException('Não foi possível carregar auditoria');
    }
  }
}
