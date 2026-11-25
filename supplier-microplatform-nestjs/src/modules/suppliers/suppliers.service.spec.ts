import { describe, expect, it, vi } from 'vitest';
import { SuppliersService } from './suppliers.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const admin: InternalAuthUser = {
  id: 'u1',
  name: '管理员',
  email: 'a@local.test',
  role: 'ADMIN',
};
const member: InternalAuthUser = { ...admin, id: 'u2', role: 'MEMBER' };

const supplier = {
  id: 'sup1',
  code: 'SUP-1',
  name: '供应商A',
  createdByUserId: 'u2',
  visibilityScope: 'CUSTOM',
  ratingAvg: 0,
  ratingCount: 0,
};

function service(options: {
  findFirst?: Record<string, unknown> | null;
  findUniqueQueue?: Array<Record<string, unknown> | null>;
} = {}) {
  const findUnique = vi.fn();
  for (const value of options.findUniqueQueue ?? []) {
    findUnique.mockResolvedValueOnce(value);
  }
  const prisma = {
    supplier: {
      findFirst: vi.fn(async () => options.findFirst ?? null),
      findUnique,
      update: vi.fn(async () => supplier),
    },
    supplierRating: {
      aggregate: vi.fn(async () => ({
        _avg: { score: 4.26 },
        _count: { _all: 3 },
      })),
    },
  };
  return {
    suppliers: new SuppliersService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('SuppliersService 可见范围', () => {
  it('管理员可见全部供应商', () => {
    const { suppliers } = service();
    expect(suppliers.visibleWhere(admin)).toEqual({});
  });

  it('普通成员仅可见全部公开/自己创建/被授权供应商', () => {
    const { suppliers } = service();
    expect(suppliers.visibleWhere(member)).toEqual({
      OR: [
        { visibilityScope: 'ALL' },
        { createdByUserId: 'u2' },
        { visibilityUsers: { some: { userId: 'u2' } } },
      ],
    });
  });

  it('不可见供应商返回 NOT_FOUND', async () => {
    const { suppliers } = service({ findFirst: null });
    await expect(suppliers.getVisible('sup1', member)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('非管理员非创建者不能管理供应商', async () => {
    const { suppliers } = service({ findUniqueQueue: [supplier] });
    await expect(
      suppliers.getManageableSupplier('sup1', { ...member, id: 'u9' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('创建者可管理供应商', async () => {
    const { suppliers } = service({ findUniqueQueue: [supplier] });
    await expect(
      suppliers.getManageableSupplier('sup1', member),
    ).resolves.toMatchObject({ id: 'sup1' });
  });
});

describe('SuppliersService 编号与评级', () => {
  it('编号冲突时顺延', async () => {
    const { suppliers } = service({
      findUniqueQueue: [{ id: 'existing1' }, null],
    });
    const code = await suppliers.generateCode();
    expect(code).toMatch(/^SUP-\d{8}-0002$/);
  });

  it('重算评级写入平均分与数量', async () => {
    const { suppliers, prisma } = service();
    await suppliers.recalcRating('sup1');
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup1' },
      data: { ratingAvg: 4.3, ratingCount: 3 },
    });
  });

  it('无评级记录时平均分为 0', async () => {
    const { suppliers, prisma } = service();
    prisma.supplierRating.aggregate.mockResolvedValueOnce({
      _avg: { score: null },
      _count: { _all: 0 },
    } as never);
    await suppliers.recalcRating('sup1');
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup1' },
      data: { ratingAvg: 0, ratingCount: 0 },
    });
  });
});
