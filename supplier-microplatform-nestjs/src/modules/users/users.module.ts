import { Module } from '@nestjs/common';
import { InternalDirectoryController } from './internal-directory.controller.js';
import { UsersController } from './users.controller.js';

@Module({
  controllers: [UsersController, InternalDirectoryController],
})
export class UsersModule {}
