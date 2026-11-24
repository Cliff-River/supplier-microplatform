import {
  Body,
  Controller,
  Delete,
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
import { AppException } from '../../common/errors/app.exception.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import {
  paginationMeta,
  parsePagination,
} from '../../common/utils/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SuppliersService } from './suppliers.service.js';

const listQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  visibilityScope: z.enum(['ALL', 'SPECIFIED']).optional(),
  ratingMin: z.coerce.number().min(0).max(5).optional(),
  sortBy: z.enum(['name', 'ratingAvg', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const baseSupplierSchema = z.object({
  name: z.string().trim().min(1, '供应商名称不能为空').max(100),
  code: z.string().trim().max(40).optional(),
  shortName: z.string().trim().max(50).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  taxId: z.string().trim().max(50).nullable().optional(),
  remark: z.string().trim().max(1000).nullable().optional(),
  visibilityScope: z.enum(['ALL', 'SPECIFIED']).default('ALL'),
  visibilityUserIds: z.array(z.string()).optional(),
});

const createSchema = baseSupplierSchema.extend({
  account: z
    .object({
      name: z.string().trim().min(1, '姓名不能为空').max(50),
      username: z
        .string()
        .trim()
        .min(3, '用户名至少 3 个字符')
        .max(30, '用户名最多 30 个字符')
        .regex(/^[a-zA-Z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点和横线'),
      email: z.email('邮箱格式不正确'),
      phone: z.string().trim().max(30).nullable().optional(),
      title: z.string().trim().max(50).nullable().optional(),
    })
    .optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, '供应商名称不能为空').max(100).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  shortName: z.string().trim().max(50).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  taxId: z.string().trim().max(50).nullable().optional(),
  remark: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

const visibilitySchema = z.object({
  visibilityScope: z.enum(['ALL', 'SPECIFIED']),
  visibilityUserIds: z.array(z.string()).optional(),
});

const accountCreateSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50),
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 个字符')
    .max(30, '用户名最多 30 个字符')
    .regex(/^[a-zA-Z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点和横线'),
  email: z.email('邮箱格式不正确'),
  phone: z.string().trim().max(30).nullable().optional(),
  title: z.string().trim().max(50).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

const accountUpdateSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  title: z.string().trim().max(50).nullable().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const ratingSchema = z.object({
  inquiryId: z.string().min(1, '请选择关联询价'),
  quoteQuality: z.coerce.number().int().min(1).max(5),
  responseSpeed: z.coerce.number().int().min(1).max(5),
  serviceAttitude: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).nullable().optional(),
});

@Controller('suppliers')
@UseGuards(InternalAuthGuard)
export class SuppliersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
    private readonly accounts: AccountService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>,
    @CurrentUser() user: InternalAuthUser,
  ) {
    const pagination = parsePagination(query);
    const where = {
      AND: [
        this.suppliers.visibleWhere(user),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.visibilityScope
          ? [{ visibilityScope: query.visibilityScope }]
          : []),
        ...(query.ratingMin !== undefined
          ? [{ ratingAvg: { gte: query.ratingMin } }]
          : []),
        ...(query.keyword
          ? [
              {
                OR: [
                  {
                    name: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    code: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    const ids = suppliers.map((item) => item.id);
    const [accounts, invitations, orders] = await Promise.all([
      ids.length
        ? this.prisma.supplierUser.groupBy({
            by: ['supplierId'],
            where: { supplierId: { in: ids }, deletedAt: null },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ids.length
        ? this.prisma.inquirySupplier.findMany({
            where: {
              supplierId: { in: ids },
              inquiry: { status: 'OPEN' },
            },
            select: { supplierId: true },
          })
        : Promise.resolve([]),
      ids.length
        ? this.prisma.order.findMany({
            where: {
              supplierId: { in: ids },
              status: { not: 'CANCELLED' },
            },
            select: { supplierId: true },
          })
        : Promise.resolve([]),
    ]);

    const accountMap = new Map(
      accounts.map((row) => [row.supplierId, row._count._all]),
    );
    const invitationMap = new Map<string, number>();
    for (const row of invitations) {
      invitationMap.set(
        row.supplierId,
        (invitationMap.get(row.supplierId) ?? 0) + 1,
      );
    }
    const orderMap = new Map<string, number>();
    for (const row of orders) {
      orderMap.set(row.supplierId, (orderMap.get(row.supplierId) ?? 0) + 1);
    }

    return {
      data: suppliers.map((supplier) => ({
        ...supplier,
        accountCount: accountMap.get(supplier.id) ?? 0,
        openInquiryCount: invitationMap.get(supplier.id) ?? 0,
        orderCount: orderMap.get(supplier.id) ?? 0,
        canManage: this.suppliers.canManage(supplier, user),
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
    if (
      body.visibilityScope === 'SPECIFIED' &&
      (!body.visibilityUserIds || body.visibilityUserIds.length === 0)
    ) {
      throw AppException.validation('指定可见范围时至少选择 1 个用户');
    }

    const code = body.code?.trim() || (await this.suppliers.generateCode());
    const exists = await this.prisma.supplier.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) {
      throw AppException.invalidState('供应商编码已存在');
    }

    const supplier = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          code,
          name: body.name,
          shortName: body.shortName ?? null,
          category: body.category ?? null,
          address: body.address ?? null,
          website: body.website ?? null,
          taxId: body.taxId ?? null,
          remark: body.remark ?? null,
          visibilityScope: body.visibilityScope,
          createdByUserId: user.id,
        },
      });
      if (
        body.visibilityScope === 'SPECIFIED' &&
        body.visibilityUserIds?.length
      ) {
        await tx.supplierVisibilityUser.createMany({
          data: body.visibilityUserIds.map((userId) => ({
            supplierId: created.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    await this.audit.record({
      action: 'supplier.created',
      targetType: 'supplier',
      targetId: supplier.id,
      summary: `创建供应商 ${supplier.name}`,
      actor: user,
      request,
      afterData: { code: supplier.code, visibilityScope: supplier.visibilityScope },
    });

    let accountResult:
      | {
          status: 'created' | 'failed';
          account?: unknown;
          message?: string;
        }
      | undefined;

    if (body.account) {
      try {
        accountResult = {
          status: 'created',
          account: await this.accounts.createSupplierUser(
            supplier.id,
            body.account,
            user,
            request,
          ),
        };
      } catch (error) {
        accountResult = {
          status: 'failed',
          message: error instanceof Error ? error.message : '账号创建失败',
        };
      }
    }

    return { ...supplier, accountResult };
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
  ) {
    const supplier = await this.suppliers.getVisible(id, user);

    const [accounts, visibilityRows, ratings, quotes, orders] =
      await Promise.all([
        this.prisma.supplierUser.findMany({
          where: { supplierId: id, deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            phone: true,
            title: true,
            isPrimary: true,
            isActive: true,
            createdAt: true,
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
          },
        }),
        this.prisma.supplierVisibilityUser.findMany({
          where: { supplierId: id },
          select: { userId: true },
        }),
        this.prisma.supplierRating.findMany({
          where: { supplierId: id },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        }),
        this.prisma.quote.findMany({
          where: { supplierId: id },
          orderBy: { submittedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            totalPrice: true,
            currency: true,
            version: true,
            submittedAt: true,
            inquiry: {
              select: {
                id: true,
                code: true,
                title: true,
                status: true,
                project: { select: { id: true, name: true } },
                order: { select: { id: true, orderNo: true } },
              },
            },
          },
        }),
        this.prisma.order.findMany({
          where: { supplierId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNo: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

    const userIds = visibilityRows.map((row) => row.userId);
    const ratingUserIds = [...new Set(ratings.map((row) => row.ratedByUserId))];
    const relatedUsers = await this.prisma.internalUser.findMany({
      where: { id: { in: [...new Set([...userIds, ...ratingUserIds])] } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(relatedUsers.map((item) => [item.id, item]));

    return {
      ...supplier,
      canManage: this.suppliers.canManage(supplier, user),
      accounts: accounts.map(({ sessions, ...account }) => ({
        ...account,
        lastLoginAt: sessions[0]?.createdAt ?? null,
      })),
      visibilityUsers: visibilityRows.map((row) => ({
        id: row.userId,
        name: userMap.get(row.userId)?.name ?? null,
        email: userMap.get(row.userId)?.email ?? null,
      })),
      ratings: ratings.map((rating) => ({
        ...rating,
        ratedByName: userMap.get(rating.ratedByUserId)?.name ?? null,
      })),
      cooperation: { quotes, orders },
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const supplier = await this.suppliers.getManageableSupplier(id, user);

    if (body.code && body.code !== supplier.code) {
      const exists = await this.prisma.supplier.findUnique({
        where: { code: body.code },
        select: { id: true },
      });
      if (exists) {
        throw AppException.invalidState('供应商编码已存在');
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.shortName !== undefined ? { shortName: body.shortName } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.taxId !== undefined ? { taxId: body.taxId } : {}),
        ...(body.remark !== undefined ? { remark: body.remark } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    await this.audit.record({
      action: 'supplier.updated',
      targetType: 'supplier',
      targetId: id,
      summary: `更新供应商 ${updated.name}`,
      actor: user,
      request,
      beforeData: {
        name: supplier.name,
        status: supplier.status,
        code: supplier.code,
      },
      afterData: { name: updated.name, status: updated.status, code: updated.code },
    });

    return updated;
  }

  @Patch(':id/visibility')
  async updateVisibility(
    @Param('id') id: string,
    @Body({ schema: visibilitySchema })
    body: z.infer<typeof visibilitySchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const supplier = await this.suppliers.getManageableSupplier(id, user);
    if (
      body.visibilityScope === 'SPECIFIED' &&
      (!body.visibilityUserIds || body.visibilityUserIds.length === 0)
    ) {
      throw AppException.validation('指定可见范围时至少选择 1 个用户');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: { visibilityScope: body.visibilityScope },
      });
      await tx.supplierVisibilityUser.deleteMany({ where: { supplierId: id } });
      if (
        body.visibilityScope === 'SPECIFIED' &&
        body.visibilityUserIds?.length
      ) {
        await tx.supplierVisibilityUser.createMany({
          data: body.visibilityUserIds.map((userId) => ({
            supplierId: id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    });

    await this.audit.record({
      action: 'supplier.visibility_updated',
      targetType: 'supplier',
      targetId: id,
      summary: `调整供应商 ${supplier.name} 可见范围`,
      actor: user,
      request,
      beforeData: { visibilityScope: supplier.visibilityScope },
      afterData: {
        visibilityScope: body.visibilityScope,
        userIds: body.visibilityUserIds ?? [],
      },
    });

    return {
      id,
      visibilityScope: body.visibilityScope,
      visibilityUserIds: body.visibilityUserIds ?? [],
    };
  }

  @Post(':id/accounts')
  async createAccount(
    @Param('id') id: string,
    @Body({ schema: accountCreateSchema })
    body: z.infer<typeof accountCreateSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.suppliers.getManageableSupplier(id, user);
    return this.accounts.createSupplierUser(id, body, user, request);
  }

  @Get(':id/ratings')
  async listRatings(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
  ) {
    await this.suppliers.getVisible(id, user);
    const ratings = await this.prisma.supplierRating.findMany({
      where: { supplierId: id },
      orderBy: { updatedAt: 'desc' },
    });
    const userIds = [...new Set(ratings.map((row) => row.ratedByUserId))];
    const users = await this.prisma.internalUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((item) => [item.id, item.name]));
    const count = ratings.length;
    const averages = count
      ? {
          quoteQuality:
            ratings.reduce((sum, row) => sum + row.quoteQuality, 0) / count,
          responseSpeed:
            ratings.reduce((sum, row) => sum + row.responseSpeed, 0) / count,
          serviceAttitude:
            ratings.reduce((sum, row) => sum + row.serviceAttitude, 0) / count,
        }
      : { quoteQuality: 0, responseSpeed: 0, serviceAttitude: 0 };

    return {
      averages: {
        quoteQuality: Number(averages.quoteQuality.toFixed(1)),
        responseSpeed: Number(averages.responseSpeed.toFixed(1)),
        serviceAttitude: Number(averages.serviceAttitude.toFixed(1)),
      },
      items: ratings.map((rating) => ({
        ...rating,
        ratedByName: userMap.get(rating.ratedByUserId) ?? null,
      })),
    };
  }

  @Post(':id/ratings')
  async createRating(
    @Param('id') id: string,
    @Body({ schema: ratingSchema }) body: z.infer<typeof ratingSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.suppliers.getVisible(id, user);

    const quote = await this.prisma.quote.findUnique({
      where: {
        inquiryId_supplierId: {
          inquiryId: body.inquiryId,
          supplierId: id,
        },
      },
      select: { id: true },
    });
    if (!quote) {
      throw AppException.validation('仅可评价已报价或已选标的询价');
    }

    const score = Number(
      (
        (body.quoteQuality + body.responseSpeed + body.serviceAttitude) /
        3
      ).toFixed(1),
    );

    const rating = await this.prisma.supplierRating.upsert({
      where: {
        supplierId_ratedByUserId_inquiryId: {
          supplierId: id,
          ratedByUserId: user.id,
          inquiryId: body.inquiryId,
        },
      },
      create: {
        supplierId: id,
        ratedByUserId: user.id,
        inquiryId: body.inquiryId,
        quoteQuality: body.quoteQuality,
        responseSpeed: body.responseSpeed,
        serviceAttitude: body.serviceAttitude,
        score,
        comment: body.comment ?? null,
      },
      update: {
        quoteQuality: body.quoteQuality,
        responseSpeed: body.responseSpeed,
        serviceAttitude: body.serviceAttitude,
        score,
        comment: body.comment ?? null,
      },
    });

    await this.suppliers.recalcRating(id);
    await this.audit.record({
      action: 'supplier.rated',
      targetType: 'supplier',
      targetId: id,
      summary: `评价供应商（询价 ${body.inquiryId}，综合 ${score} 分）`,
      actor: user,
      request,
      afterData: {
        inquiryId: body.inquiryId,
        quoteQuality: body.quoteQuality,
        responseSpeed: body.responseSpeed,
        serviceAttitude: body.serviceAttitude,
        score,
      },
    });

    return rating;
  }
}

@Controller('supplier-accounts')
@UseGuards(InternalAuthGuard)
export class SupplierAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
    private readonly accounts: AccountService,
    private readonly audit: AuditService,
  ) {}

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: accountUpdateSchema })
    body: z.infer<typeof accountUpdateSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const account = await this.prisma.supplierUser.findUnique({
      where: { id },
    });
    if (!account || account.deletedAt) {
      throw AppException.notFound('账号不存在');
    }
    await this.suppliers.getManageableSupplier(account.supplierId, user);

    if (body.isActive !== undefined && body.isActive !== account.isActive) {
      await this.accounts.setSupplierUserActive(
        id,
        body.isActive,
        user,
        request,
      );
    }

    const updated = await this.prisma.supplierUser.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        title: true,
        isPrimary: true,
        isActive: true,
      },
    });

    await this.audit.record({
      action: 'supplier_user.updated',
      targetType: 'supplier_user',
      targetId: id,
      summary: `更新供应商账号 ${updated.username}`,
      actor: user,
      request,
    });

    return updated;
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const account = await this.prisma.supplierUser.findUnique({
      where: { id },
    });
    if (!account || account.deletedAt) {
      throw AppException.notFound('账号不存在');
    }
    await this.suppliers.getManageableSupplier(account.supplierId, user);
    await this.accounts.requestSupplierReset(account.email);
    await this.audit.record({
      action: 'supplier_user.reset_password',
      targetType: 'supplier_user',
      targetId: id,
      summary: `为供应商账号 ${account.username} 触发重置密码`,
      actor: user,
      request,
    });
    return { id, email: account.email };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const account = await this.prisma.supplierUser.findUnique({
      where: { id },
    });
    if (!account || account.deletedAt) {
      throw AppException.notFound('账号不存在');
    }
    await this.suppliers.getManageableSupplier(account.supplierId, user);
    return this.accounts.removeSupplierUser(id, user, request);
  }
}
