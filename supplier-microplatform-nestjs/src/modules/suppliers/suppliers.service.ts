import { Injectable } from '@nestjs/common';
import type { Prisma, Supplier } from '../../generated/prisma/client.js';
import { AppException } from '../../common/errors/app.exception.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { shanghaiDateStamp } from '../../common/utils/codes.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 当前用户可见的供应商筛选条件 */
  visibleWhere(user: InternalAuthUser): Prisma.SupplierWhereInput {
    if (user.role === 'ADMIN') {
      return {};
    }
    return {
      OR: [
        { visibilityScope: 'ALL' },
        { createdByUserId: user.id },
        { visibilityUsers: { some: { userId: user.id } } },
      ],
    };
  }

  async getVisible(id: string, user: InternalAuthUser): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, AND: [this.visibleWhere(user)] },
    });
    if (!supplier) {
      throw AppException.notFound('供应商不存在');
    }
    return supplier;
  }

  canManage(supplier: Supplier, user: InternalAuthUser): boolean {
    return user.role === 'ADMIN' || supplier.createdByUserId === user.id;
  }

  assertManageable(supplier: Supplier, user: InternalAuthUser): void {
    if (!this.canManage(supplier, user)) {
      throw AppException.forbidden('仅管理员或创建者可执行此操作');
    }
  }

  async getManageableSupplier(
    id: string,
    user: InternalAuthUser,
  ): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw AppException.notFound('供应商不存在');
    }
    this.assertManageable(supplier, user);
    return supplier;
  }

  async generateCode(): Promise<string> {
    const prefix = `SUP-${shanghaiDateStamp()}`;
    for (let i = 0; i < 50; i += 1) {
      const code = `${prefix}-${`${i + 1}`.padStart(4, '0')}`;
      const exists = await this.prisma.supplier.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  /** 重新计算供应商评级汇总 */
  async recalcRating(supplierId: string): Promise<void> {
    const aggregate = await this.prisma.supplierRating.aggregate({
      where: { supplierId },
      _avg: { score: true },
      _count: { _all: true },
    });
    const avg = aggregate._avg.score ?? 0;
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ratingAvg: Number(avg.toFixed(1)),
        ratingCount: aggregate._count._all,
      },
    });
  }
}
