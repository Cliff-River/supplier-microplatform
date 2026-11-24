import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AppException } from '../errors/app.exception.js';
import type { AuthUser } from '../types/auth-user.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ authUser?: AuthUser }>();
    const user = request.authUser;
    if (!user || user.kind !== 'INTERNAL') {
      throw AppException.forbidden('需要内部管理员权限');
    }
    if (!required.includes(user.role)) {
      throw AppException.forbidden('需要内部管理员权限');
    }
    return true;
  }
}
