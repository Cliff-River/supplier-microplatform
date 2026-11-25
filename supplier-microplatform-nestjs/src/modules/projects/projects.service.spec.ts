import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './projects.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const admin: InternalAuthUser = {
  id: 'u1',
  name: '管理员',
  email: 'a@local.test',
  role: 'ADMIN',
};
const member: InternalAuthUser = { ...admin, id: 'u2', role: 'MEMBER' };

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    code: 'PRJ-1',
    name: '项目',
    status: 'ACTIVE',
    createdByUserId: 'u2',
    createdAt: new Date(),
    ...overrides,
  };
}

function service(overrides: {
  project?: Record<string, unknown> | null;
  inquiryCodeExists?: boolean;
} = {}) {
  let inquiryLookups = 0;
  const prisma = {
    project: {
      findUnique: vi.fn(async () => overrides.project ?? null),
      findMany: vi.fn(async () => []),
    },
    inquiry: {
      findUnique: vi.fn(async () => {
        if (!overrides.inquiryCodeExists) return null;
        inquiryLookups += 1;
        return inquiryLookups === 1 ? { id: 'i' } : null;
      }),
      findMany: vi.fn(async () => [
        {
          id: 'i1',
          _count: { invited: 2, quotes: 3 },
          order: null,
        },
      ]),
    },
    internalUser: {
      findUnique: vi.fn(async () => ({ id: 'u2', name: '创建者', email: 'm@local.test' })),
    },
    order: {
      findMany: vi.fn(async () => [
        {
          id: 'o1',
          contract: { status: 'PENDING_SUBMISSION' },
          acceptance: null,
          _count: { invoices: 1 },
        },
      ]),
    },
    invoice: { findMany: vi.fn(async () => []) },
    auditLog: { findMany: vi.fn(async () => []) },
  };
  return {
    projects: new ProjectsService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('ProjectsService 权限', () => {
  it('管理员与创建者可管理项目', () => {
    const { projects } = service();
    expect(projects.canManage(project() as never, admin)).toBe(true);
    expect(projects.canManage(project() as never, member)).toBe(true);
    expect(projects.canManage(project() as never, { ...member, id: 'u9' })).toBe(false);
  });

  it('非创建者非管理员执行管理操作时返回 FORBIDDEN', () => {
    const { projects } = service();
    try {
      projects.assertManageable(project() as never, { ...member, id: 'u9' });
      throw new Error('应当抛出异常');
    } catch (error) {
      expect((error as AppException).code).toBe(ErrorCode.FORBIDDEN);
    }
  });
});

describe('ProjectsService 查询与编号', () => {
  it('项目不存在返回 NOT_FOUND', async () => {
    const { projects } = service({ project: null });
    await expect(projects.getOrThrow('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('生成项目编号与询价编号', async () => {
    const { projects } = service();
    await expect(projects.generateCode()).resolves.toMatch(/^PRJ-\d{8}-0001$/);
    await expect(projects.generateInquiryCode()).resolves.toMatch(
      /^INQ-\d{8}-0001$/,
    );
  });

  it('编号已存在时顺延', async () => {
    const { projects } = service({ inquiryCodeExists: true });
    await expect(projects.generateInquiryCode()).resolves.toMatch(
      /^INQ-\d{8}-0002$/,
    );
  });

  it('详情聚合邀请/报价/订单与审计记录', async () => {
    const { projects, prisma } = service({ project: project() });
    const detail = await projects.detail('p1', member);
    expect(detail.creatorName).toBe('创建者');
    expect(detail.canManage).toBe(true);
    expect(detail.inquiries[0]).toMatchObject({
      invitedCount: 2,
      quoteCount: 3,
    });
    expect(detail.inquiries[0]?._count).toBeUndefined();
    expect(detail.orders[0]).toMatchObject({
      contractStatus: 'PENDING_SUBMISSION',
      acceptanceStatus: null,
      invoiceCount: 1,
    });
    expect(detail.orders[0]?.contract).toBeUndefined();
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
  });
});
