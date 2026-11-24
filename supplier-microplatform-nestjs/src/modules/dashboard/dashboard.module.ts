import { Module } from '@nestjs/common';
import {
  DashboardController,
  SupplierDashboardController,
} from './dashboard.controller.js';

@Module({
  controllers: [DashboardController, SupplierDashboardController],
})
export class DashboardModule {}
