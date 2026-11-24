import { Module } from '@nestjs/common';
import {
  SupplierAccountsController,
  SuppliersController,
} from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  controllers: [SuppliersController, SupplierAccountsController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
