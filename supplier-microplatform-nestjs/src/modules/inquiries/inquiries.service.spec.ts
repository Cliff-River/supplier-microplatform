import { describe, expect, it, vi } from 'vitest';
import { InquiriesService } from './inquiries.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const admin: InternalAuthUser = {
  id: 'u1',
  name: '管理员',
  email: 'a@local.test',
  role: 'ADMIN',
};
const member: InternalAuthUser = { ...admin, id: 'u9', role: 'MEMBER' };

const project = {
  id: 'p1',
  name: '项目',
  code: 'PRJ-1',
  createdByUserId: 'u1',
  status: 'ACTIVE',
  contactName: '联系人',
  contactEmail: 'c@local.test',
  contactPhone: null,
};

function inquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    title: '询价一',
    description: null,
    quantity: 10,
    unit: '件',
    status: 'OPEN',
    deadline: new Date(Date.now() + 60 * 60 * 1000),
    openedAt: null,
    closedAt: null,
    projectId: 'p1',
    project,
    ...overrides,
  };
}

function service(options: { current?: Record<string, unknown> | null } = {}) {
  const inquiryFindUnique = vi.fn(async () =>
    'current' in options ? options.current : inquiry(),
  );
  const order = {
    id: 'o1',
    orderNo: 'ORD-1',
    amount: 100,
    currency: 'CNY',
    supplierId: 'sup1',
    project,
    inquiry: inquiry(),
    supplier: { name: '供应商A' },
    contract: { id: 'c1' },
  };
  const tx = {
    inquiry: { updateMany: vi.fn(async () => ({ count: 1 })) },
    order: { create: vi.fn(async () => ({ id: 'o1', orderNo: 'ORD-1' })) },
    contract: { create: vi.fn(async () => ({ id: 'c1' })) },
  };
  const prisma = {
    project: { findUnique: vi.fn(async () => project) },
    inquiry: {
      findUnique: inquiryFindUnique,
      findMany: vi.fn(async () => [{ id: 'i1', title: '询价一' }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async () => ({ id: 'i1' })),
    },
    inquirySupplier: {
      findMany: vi.fn(async () => [{ id: 'inv1', supplierId: 'sup1' }]),
      createMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
    supplier: {
      findMany: vi.fn(async () => [{ id: 'sup1' }]),
      findUnique: vi.fn(async () => ({ name: '供应商A' })),
    },
    supplierUser: { findMany: vi.fn(async () => []) },
    attachment: { findMany: vi.fn(async () => []) },
    quote: {
      findUnique: vi.fn(async () => ({
        id: 'q1',
        totalPrice: { toString: () => '100' },
        currency: 'CNY',
      })),
    },
    order: {
      findUnique: vi.fn(async (args: { select?: unknown }) =>
        args.select ? null : order,
      ),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const mail = { send: vi.fn(async () => ({ id: 'm1', status: 'SENT' })) };
  const settings = {
    getPlatformInfo: vi.fn(async () => ({
      name: '供应商微平台',
      url: 'http://localhost:3000',
    })),
  };
  const storage = {
    bind: vi.fn(async () => undefined),
    absolutePath: vi.fn(() => '/tmp/file'),
  };
  const inquiries = new InquiriesService(
    prisma as unknown as PrismaService,
    audit as never,
    mail as never,
    settings as never,
    storage as never,
  );
  return { inquiries, prisma, audit, mail, storage, tx };
}

describe('InquiriesService 查询与权限', () => {
  it('询价不存在返回 NOT_FOUND', async () => {
    const { inquiries } = service({ current: null });
    await expect(inquiries.getInquiryOrThrow('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('非管理员非创建者不能关闭询价', async () => {
    const { inquiries } = service();
    await expect(inquiries.close('i1', member)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});

describe('InquiriesService 状态流转', () => {
  it('仅开放中的询价可关闭', async () => {
    const { inquiries } = service({ current: inquiry({ status: 'DRAFT' }) });
    await expect(inquiries.close('i1', admin)).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE,
    });
  });

  it('关闭询价写入审计', async () => {
    const { inquiries, prisma, audit } = service();
    await inquiries.close('i1', admin);
    expect(prisma.inquiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', status: 'OPEN' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inquiry.closed' }),
    );
  });

  it('仅草稿或已关闭可作废', async () => {
    const { inquiries } = service();
    await expect(inquiries.cancel('i1', admin)).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE,
    });
  });

  it('草稿询价可作废', async () => {
    const { inquiries, audit } = service({
      current: inquiry({ status: 'DRAFT' }),
    });
    await inquiries.cancel('i1', admin);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inquiry.cancelled' }),
    );
  });

  it('仅已关闭询价可重新开放', async () => {
    const { inquiries } = service();
    await expect(
      inquiries.reopen('i1', new Date(Date.now() + 3600_000), false, admin),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
  });

  it('重新开放需要未来截止时间', async () => {
    const { inquiries } = service({ current: inquiry({ status: 'CLOSED' }) });
    await expect(
      inquiries.reopen('i1', new Date(Date.now() - 1000), false, admin),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('重新开放且不重发时返回 null', async () => {
    const { inquiries, prisma } = service({
      current: inquiry({ status: 'CLOSED' }),
    });
    await expect(
      inquiries.reopen('i1', new Date(Date.now() + 3600_000), false, admin),
    ).resolves.toBeNull();
    expect(prisma.inquiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', status: 'CLOSED' },
      data: expect.objectContaining({ status: 'OPEN' }),
    });
  });

  it('到期自动关闭并记录审计', async () => {
    const { inquiries, prisma, audit } = service();
    await expect(inquiries.closeExpired()).resolves.toBe(1);
    expect(prisma.inquiry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['i1'] }, status: 'OPEN' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inquiry.auto_closed' }),
    );
  });
});

describe('InquiriesService 选标', () => {
  it('未关闭的询价不可选标', async () => {
    const { inquiries } = service();
    await expect(inquiries.award('i1', 'sup1', admin)).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE,
    });
  });

  it('供应商未报价时不可选标', async () => {
    const { inquiries, prisma } = service({
      current: inquiry({ status: 'CLOSED' }),
    });
    prisma.quote.findUnique.mockResolvedValueOnce(null);
    await expect(inquiries.award('i1', 'sup1', admin)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
    });
  });

  it('选标生成订单与合同', async () => {
    const { inquiries, tx, audit } = service({
      current: inquiry({ status: 'CLOSED' }),
    });
    await expect(inquiries.award('i1', 'sup1', admin)).resolves.toMatchObject({
      id: 'o1',
    });
    expect(tx.inquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'i1', status: 'CLOSED' },
      }),
    );
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inquiryId: 'i1',
        supplierId: 'sup1',
        status: 'PENDING_CONTRACT',
      }),
    });
    expect(tx.contract.create).toHaveBeenCalledWith({
      data: { orderId: 'o1' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inquiry.awarded' }),
    );
  });
});
