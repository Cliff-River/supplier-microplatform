import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import {
  INTERNAL_AUTH,
  SUPPLIER_AUTH,
  type InternalAuth,
  type SupplierAuth,
} from '../../auth/auth.tokens.js';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../types/auth-user.js';

/**
 * 文件等双端共用接口：优先尝试内部会话，再尝试供应商会话。
 */
@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    @Inject(INTERNAL_AUTH) private readonly internalAuth: InternalAuth,
    @Inject(SUPPLIER_AUTH) private readonly supplierAuth: SupplierAuth,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const headers = fromNodeHeaders(request.headers);

    const internalSession = await this.internalAuth.api.getSession({ headers });
    if (internalSession?.user) {
      const user = await this.prisma.internalUser.findUnique({
        where: { id: internalSession.user.id },
      });
      if (!user || !user.isActive || user.deletedAt) {
        throw new AppException(
          ErrorCode.ACCOUNT_DISABLED,
          '账号已停用，请联系管理员',
          403,
        );
      }
      if (user.mustChangePassword) {
        throw new AppException(
          ErrorCode.PASSWORD_CHANGE_REQUIRED,
          '首次登录请先修改密码',
          403,
        );
      }
      const authUser: AuthUser = {
        kind: 'INTERNAL',
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      };
      (request as Request & { authUser: AuthUser }).authUser = authUser;
      return true;
    }

    const supplierSession = await this.supplierAuth.api.getSession({ headers });
    if (!supplierSession?.user) {
      throw AppException.unauthenticated();
    }
    const user = await this.prisma.supplierUser.findUnique({
      where: { id: supplierSession.user.id },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppException(
        ErrorCode.ACCOUNT_DISABLED,
        '账号已停用，请联系采购方',
        403,
      );
    }
    if (user.mustChangePassword) {
      throw new AppException(
        ErrorCode.PASSWORD_CHANGE_REQUIRED,
        '首次登录请先修改密码',
        403,
      );
    }
    const authUser: AuthUser = {
      kind: 'SUPPLIER',
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      supplierId: user.supplierId,
      phone: user.phone,
      title: user.title,
      isPrimary: user.isPrimary,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    };
    (request as Request & { authUser: AuthUser }).authUser = authUser;
    return true;
  }
}
