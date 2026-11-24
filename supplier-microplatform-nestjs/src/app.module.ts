import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { StorageModule } from './storage/storage.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { InquiriesModule } from './modules/inquiries/inquiries.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { HealthController } from './health.controller.js';
import { MeController } from './me.controller.js';
import { SupplierMeController } from './supplier-me.controller.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    SettingsModule,
    MailModule,
    AuthModule,
    AuditModule,
    StorageModule,
    DashboardModule,
    UsersModule,
    SuppliersModule,
    AdminModule,
    ProjectsModule,
    InquiriesModule,
    QuotesModule,
    OrdersModule,
  ],
  controllers: [HealthController, MeController, SupplierMeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
