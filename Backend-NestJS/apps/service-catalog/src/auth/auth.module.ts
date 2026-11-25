import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { User } from './user.model.js';
import { UserProfileController } from './user-profile.controller.js';
import { UserAuthGuard } from './user-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AvatarUploadController } from './avatar-upload.controller.js';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [
    AuthController,
    UserProfileController,
    AdminUsersController,
    AdminAuditController,
    AvatarUploadController,
  ],
  providers: [AuthService, UserAuthGuard, RolesGuard],
})
export class AuthModule {}
