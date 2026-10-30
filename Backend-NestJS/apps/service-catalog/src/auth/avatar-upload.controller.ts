import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/sequelize';
import { diskStorage } from 'multer';
import { mkdir, rename, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileTypeFromFile } from 'file-type';
import type { Express } from 'express';
import { User } from './user.model.js';
import { UserAuthGuard } from './user-auth.guard.js';
import type { AuthenticatedUserRequest } from './user-auth.guard.js';

const uploadDirectory = join(process.cwd(), 'uploads');
const allowedImageTypes = new Map<string, { extension: string; mimeType: string }>([
  ['image/jpeg', { extension: '.jpg', mimeType: 'image/jpeg' }],
  ['image/png', { extension: '.png', mimeType: 'image/png' }],
  ['image/webp', { extension: '.webp', mimeType: 'image/webp' }],
]);

@Controller('users')
@UseGuards(UserAuthGuard)
export class AvatarUploadController {
  private readonly logger = new Logger(AvatarUploadController.name);

  constructor(@InjectModel(User) private readonly users: typeof User) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: async (_request, _file, callback) => {
        try {
          await mkdir(uploadDirectory, { recursive: true });
          callback(null, uploadDirectory);
        } catch (error) {
          callback(error as Error, uploadDirectory);
        }
      },
      filename: (_request, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype)) {
          callback(new BadRequestException('Formato de imagem não suportado'), '');
          return;
        }
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      const expected = allowedImageTypes.get(file.mimetype);
      const originalExtension = extname(file.originalname).toLowerCase();
      const allowedExtensions = expected?.mimeType === 'image/jpeg'
        ? ['.jpg', '.jpeg']
        : expected ? [expected.extension] : [];
      if (!expected || !allowedExtensions.includes(originalExtension)) {
        callback(new BadRequestException('Envie uma imagem JPEG, PNG ou WEBP'), false);
        return;
      }
      callback(null, true);
    },
  }))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedUserRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem obrigatório (campo "file")');
    }

    let finalPath: string | undefined;
    try {
      const detectedType = await fileTypeFromFile(file.path);
      const declaredType = allowedImageTypes.get(file.mimetype);
      const originalExtension = extname(file.originalname).toLowerCase();
      const acceptedExtensions = detectedType?.mime === 'image/jpeg'
        ? ['.jpg', '.jpeg']
        : detectedType ? [`.${detectedType.ext}`] : [];

      if (
        !detectedType
        || !declaredType
        || detectedType.mime !== declaredType.mimeType
        || !acceptedExtensions.includes(originalExtension)
      ) {
        throw new BadRequestException('O conteúdo do arquivo não corresponde a uma imagem permitida');
      }

      finalPath = join(uploadDirectory, `${file.filename}${declaredType.extension}`);
      await rename(file.path, finalPath);

      const user = await this.users.findByPk(request.userId);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      const avatarUrl = `/uploads/${file.filename}${declaredType.extension}`;
      await user.update({ avatarUrl });
      return { avatarUrl };
    } catch (error) {
      await rm(file.path, { force: true });
      if (finalPath) await rm(finalPath, { force: true });
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to save uploaded avatar', error);
      throw new InternalServerErrorException('Não foi possível salvar o avatar');
    }
  }
}
