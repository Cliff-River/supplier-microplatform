import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AnyAuthGuard } from '../common/guards/any-auth.guard.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { env } from '../config/env.js';
import { StorageService } from './storage.service.js';

@Controller('files')
@UseGuards(AnyAuthGuard)
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const attachment = await this.storage.save(file, {
      type: user.kind,
      id: user.id,
    });
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.storage.deleteTemp(id, { type: user.kind, id: user.id });
    return { deleted: true };
  }

  @Post(':id/access-token')
  async accessToken(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const allowed = await this.canAccess(id, user);
    if (!allowed) {
      throw AppException.forbidden('无权访问该附件');
    }
    return this.storage.createSignedUrl(id, 300);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    this.storage.assertSignature(id, Number(expires), signature);
    const allowed = await this.canAccess(id, user);
    if (!allowed) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        '无权访问该附件',
        403,
      );
    }
    const attachment = await this.storage.getOrThrow(id);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(this.storage.streamFor(attachment.storageKey));
  }

  private canAccess(id: string, user: AuthUser): Promise<boolean> {
    return this.storage.canAccess(id, {
      kind: user.kind,
      id: user.id,
      supplierId: user.kind === 'SUPPLIER' ? user.supplierId : undefined,
    });
  }
}
