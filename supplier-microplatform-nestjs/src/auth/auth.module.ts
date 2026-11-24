import { Global, Module } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { createInternalAuth, createSupplierAuth } from './auth.config.js';
import { INTERNAL_AUTH, SUPPLIER_AUTH } from './auth.tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';

@Global()
@Module({
  providers: [
    {
      provide: INTERNAL_AUTH,
      useFactory: (prisma: PrismaService, mail: MailService) =>
        createInternalAuth(prisma, mail),
      inject: [PrismaService, MailService],
    },
    {
      provide: SUPPLIER_AUTH,
      useFactory: (prisma: PrismaService, mail: MailService) =>
        createSupplierAuth(prisma, mail),
      inject: [PrismaService, MailService],
    },
    AccountService,
  ],
  exports: [INTERNAL_AUTH, SUPPLIER_AUTH, AccountService],
})
export class AuthModule {}
