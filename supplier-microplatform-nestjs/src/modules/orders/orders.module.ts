import { Module } from '@nestjs/common';
import { OrdersController, SupplierOrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController, SupplierOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
