import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { INTERNAL_AUTH, SUPPLIER_AUTH } from './auth.tokens.js';
import type { InternalAuth, SupplierAuth } from './auth.tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { env } from '../config/env.js';

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateInitialPassword(length = 12): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return `${result}9a`;
}

export interface CreateInternalUserInput {
  name: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'MEMBER';
  phone?: string | null;
}

export interface CreateSupplierUserInput {
  name: string;
  email: string;
  username: string;
  phone?: string | null;
  title?: string | null;
  isPrimary?: boolean;
}

@Injectable()
export class AccountService {
  constructor(
    @Inject(INTERNAL_AUTH) private readonly internalAuth: InternalAuth,
    @Inject(SUPPLIER_AUTH) private readonly supplierAuth: SupplierAuth,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async createInternalUser(
    input: CreateInternalUserInput,
    actor: AuthUser,
    request?: Request,
  ) {
    const exists = await this.prisma.internalUser.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
      select: { email: true, username: true },
    });
    if (exists?.email === input.email) {
      throw new AppException(
        ErrorCode.DUPLICATE_EMAIL,
        '邮箱已存在',
        409,
      );
    }
    if (exists?.username === input.username) {
      throw new AppException(
        ErrorCode.DUPLICATE_USERNAME,
        '用户名已存在',
        409,
      );
    }

    const password = generateInitialPassword();
    const result = await this.internalAuth.api.signUpEmail({
      body: {
        email: input.email,
        password,
        name: input.name,
        username: input.username,
        displayUsername: input.username,
      } as never,
    });
    const userId = (result as { user: { id: string } }).user.id;

    await this.prisma.internalUser.update({
      where: { id: userId },
      data: {
        role: input.role,
        phone: input.phone ?? null,
        mustChangePassword: true,
        emailVerified: true,
      },
    });

    const mailResult = await this.mail.sendAccountCreated(
      'INTERNAL',
      [input.email],
      { name: input.name, username: input.username, password },
    );
    await this.audit.record({
      action: 'internal_user.created',
      targetType: 'internal_user',
      targetId: userId,
      summary: `创建内部用户 ${input.username}`,
      actor,
      request,
      afterData: { role: input.role, email: input.email },
    });

    return {
      id: userId,
      name: input.name,
      email: input.email,
      username: input.username,
      role: input.role,
      initialPassword: password,
      mailStatus: mailResult.status,
    };
  }

  async createSupplierUser(
    supplierId: string,
    input: CreateSupplierUserInput,
    actor: AuthUser,
    request?: Request,
  ) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw AppException.notFound('供应商不存在');
    }

    const exists = await this.prisma.supplierUser.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
      select: { email: true, username: true },
    });
    if (exists?.email === input.email) {
      throw new AppException(ErrorCode.DUPLICATE_EMAIL, '邮箱已存在', 409);
    }
    if (exists?.username === input.username) {
      throw new AppException(
        ErrorCode.DUPLICATE_USERNAME,
        '用户名已存在',
        409,
      );
    }

    const password = generateInitialPassword();
    const result = await this.supplierAuth.api.signUpEmail({
      body: {
        email: input.email,
        password,
        name: input.name,
        username: input.username,
        displayUsername: input.username,
        supplierId,
      } as never,
    });
    const userId = (result as { user: { id: string } }).user.id;

    await this.prisma.supplierUser.update({
      where: { id: userId },
      data: {
        supplierId,
        phone: input.phone ?? null,
        title: input.title ?? null,
        isPrimary: input.isPrimary ?? false,
        mustChangePassword: true,
        emailVerified: true,
      },
    });

    const mailResult = await this.mail.sendAccountCreated(
      'SUPPLIER',
      [input.email],
      { name: input.name, username: input.username, password },
    );
    await this.audit.record({
      action: 'supplier_user.created',
      targetType: 'supplier_user',
      targetId: userId,
      summary: `为供应商 ${supplier.name} 创建账号 ${input.username}`,
      actor,
      request,
      afterData: { supplierId, email: input.email },
    });

    return {
      id: userId,
      supplierId,
      name: input.name,
      email: input.email,
      username: input.username,
      initialPassword: password,
      mailStatus: mailResult.status,
    };
  }

  async requestInternalReset(email: string): Promise<void> {
    await this.internalAuth.api.requestPasswordReset({
      body: { email, redirectTo: `${env.APP_URL}/reset-password` },
    });
  }

  async requestSupplierReset(email: string): Promise<void> {
    await this.supplierAuth.api.requestPasswordReset({
      body: { email, redirectTo: `${env.APP_URL}/supplier/reset-password` },
    });
  }

  async setInternalUserActive(
    userId: string,
    isActive: boolean,
    actor: AuthUser,
    request?: Request,
  ) {
    const user = await this.prisma.internalUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    if (!isActive) {
      if (user.role === 'ADMIN') {
        const admins = await this.prisma.internalUser.count({
          where: { role: 'ADMIN', isActive: true, deletedAt: null },
        });
        if (admins <= 1) {
          throw AppException.invalidState('不能停用最后一个管理员');
        }
      }
      if (actor.id === userId) {
        throw AppException.invalidState('不能停用自己的账号');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.internalUser.update({
        where: { id: userId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.internalSession.deleteMany({ where: { userId } });
      }
    });
    await this.audit.record({
      action: isActive ? 'internal_user.enabled' : 'internal_user.disabled',
      targetType: 'internal_user',
      targetId: userId,
      summary: `${isActive ? '启用' : '停用'}内部用户 ${user.username}`,
      actor,
      request,
      beforeData: { isActive: user.isActive },
      afterData: { isActive },
    });
    return { id: userId, isActive };
  }

  async setSupplierUserActive(
    userId: string,
    isActive: boolean,
    actor: AuthUser,
    request?: Request,
  ) {
    const user = await this.prisma.supplierUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw AppException.notFound('账号不存在');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplierUser.update({
        where: { id: userId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.supplierSession.deleteMany({ where: { userId } });
      }
    });
    await this.audit.record({
      action: isActive ? 'supplier_user.enabled' : 'supplier_user.disabled',
      targetType: 'supplier_user',
      targetId: userId,
      summary: `${isActive ? '启用' : '停用'}供应商账号 ${user.username}`,
      actor,
      request,
      beforeData: { isActive: user.isActive },
      afterData: { isActive },
    });
    return { id: userId, isActive };
  }

  async removeSupplierUser(
    userId: string,
    actor: AuthUser,
    request?: Request,
  ) {
    const user = await this.prisma.supplierUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw AppException.notFound('账号不存在');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplierUser.update({
        where: { id: userId },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.supplierSession.deleteMany({ where: { userId } });
    });
    await this.audit.record({
      action: 'supplier_user.deleted',
      targetType: 'supplier_user',
      targetId: userId,
      summary: `停用并隐藏供应商账号 ${user.username}`,
      actor,
      request,
    });
    return { id: userId };
  }
}
