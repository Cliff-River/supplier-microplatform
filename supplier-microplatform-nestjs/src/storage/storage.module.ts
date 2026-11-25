import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { AttachmentCleanupService } from './attachment-cleanup.service.js';
import { FilesController } from './files.controller.js';

@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, AttachmentCleanupService],
  exports: [StorageService],
})
export class StorageModule {}
