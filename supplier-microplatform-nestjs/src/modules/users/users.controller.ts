import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AccountService } from '../../auth/account.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import {
  paginationMeta,
  parsePagination,
} from '../../common/utils/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const listQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50),
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 个字符')
    .max(30, '用户名最多 30 个字符')
    .regex(/^[a-zA-Z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点和横线'),
  email: z.email('邮箱格式不正确'),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  phone: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Controller('admin/users')
@UseGuards(InternalAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>) {
    const pagination = parsePagination(query);
    const where = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status === 'ACTIVE'
        ? { isActive: true }
        : query.status === 'DISABLED'
          ? { isActive: false }
          : {}),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' as const } },
              {
                username: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: { contains: query.keyword, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.internalUser.count({ where }),
      this.prisma.internalUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          ...userSelect,
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
    ]);

    return {
      data: users.map(({ sessions, ...user }) => ({
        ...user,
        lastLoginAt: sessions[0]?.createdAt ?? null,
      })),
      meta: paginationMeta(total, pagination),
    };
  }

  @Post()
  async create(
    @Body({ schema: createSchema }) body: z.infer<typeof createSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.accounts.createInternalUser(
      {
        name: body.name,
        email: body.email,
        username: body.username,
        phone: body.phone ?? null,
        role: body.role,
      },
      user,
      request,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const target = await this.prisma.internalUser.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      throw AppException.notFound('用户不存在');
    }
    if (
      target.role === 'ADMIN' &&
      body.role === 'MEMBER'
    ) {
      const admins = await this.prisma.internalUser.count({
        where: { role: 'ADMIN', isActive: true, deletedAt: null },
      });
      if (admins <= 1) {
        throw AppException.invalidState('不能修改最后一个管理员的角色');
      }
    }

    const updated = await this.prisma.internalUser.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
      },
      select: userSelect,
    });

    await this.audit.record({
      action: 'internal_user.updated',
      targetType: 'internal_user',
      targetId: id,
      summary: `更新内部用户 ${target.username}`,
      actor: user,
      request,
      beforeData: { name: target.name, phone: target.phone, role: target.role },
      afterData: { name: updated.name, phone: updated.phone, role: updated.role },
    });

    return updated;
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const target = await this.prisma.internalUser.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      throw AppException.notFound('用户不存在');
    }
    await this.accounts.requestInternalReset(target.email);
    await this.audit.record({
      action: 'internal_user.reset_password',
      targetType: 'internal_user',
      targetId: id,
      summary: `为内部用户 ${target.username} 触发重置密码`,
      actor: user,
      request,
    });
    return { id, email: target.email };
  }

  @Post(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body({ schema: statusSchema }) body: z.infer<typeof statusSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.accounts.setInternalUserActive(id, body.isActive, user, request);
  }
}
