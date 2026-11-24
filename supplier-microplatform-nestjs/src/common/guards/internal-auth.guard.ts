import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { INTERNAL_AUTH, type InternalAuth } from '../../auth/auth.tokens.js';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser, InternalAuthUser } from '../types/auth-user.js';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    @Inject(INTERNAL_AUTH) private readonly auth: InternalAuth,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user) {
      throw AppException.unauthenticated();
    }

    const user = await this.prisma.internalUser.findUnique({
      where: { id: session.user.id },
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

    const authUser: InternalAuthUser = {
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
}
