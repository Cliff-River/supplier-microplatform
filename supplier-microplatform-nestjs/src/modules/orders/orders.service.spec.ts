import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';

const admin: InternalAuthUser = {
  id: 'u1',
  name: '管理员',
  email: 'a@local.test',
  role: 'ADMIN',
};
const member: InternalAuthUser = { ...admin, id: 'u9', role: 'MEMBER' };

const supplierUser = {
  id: 's1',
  supplierId: 'sup1',
  name: '供应商',
  email: 's@local.test',
};

function service(status: string, overrides: Record<string, unknown> = {}) {
  const createInvoice = vi.fn(async () => ({
    id: 'inv1',
    orderId: 'o1',
    invoiceNo: 'INV-1',
  }));
  const tx = {
    contractFile: { createMany: vi.fn(async () => ({ count: 1 })) },
    contract: { update: vi.fn(async () => ({})) },
    order: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    order: {
      findUnique: vi.fn(async () => ({
        id: 'o1',
        orderNo: 'ORD-1',
        supplierId: 'sup1',
        status,
        contract: { id: 'c1', status: 'SUBMITTED' },
        acceptance: { id: 'a1', status: 'UPLOADED', supplierFileId: 'att1' },
        invoices: [],
        project: {
          id: 'p1',
          name: '项目',
          code: 'P-1',
          contactName: '联系人',
          contactEmail: 'c@local.test',
          contactPhone: null,
          createdByUserId: 'u1',
        },
        supplier: { id: 'sup1', name: '供应商A' },
        inquiry: { id: 'i1', title: '询价' },
        ...overrides,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 1),
      findMany: vi.fn(async () => [
        {
          id: 'o1',
          orderNo: 'ORD-1',
          project: { id: 'p1', name: '项目', code: 'P-1' },
          inquiry: { id: 'i1', title: '询价' },
          supplier: { id: 'sup1', name: '供应商A' },
          contract: { status: 'SUBMITTED' },
          acceptance: null,
          _count: { invoices: 2 },
        },
      ]),
    },
    internalUser: { findUnique: vi.fn(async () => null) },
    supplierUser: { findMany: vi.fn(async () => []) },
    attachment: { findMany: vi.fn(async () => []) },
    invoice: { create: createInvoice },
    acceptanceCertificate: {
      create: vi.fn(async () => ({ id: 'a1' })),
      update: vi.fn(async () => ({})),
    },
    contractFile: { createMany: vi.fn(async () => ({ count: 1 })) },
    contract: { update: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const mail = { send: vi.fn(async () => undefined) };
  const storage = {
    bind: vi.fn(async () => undefined),
    absolutePath: vi.fn(() => '/tmp/file'),
  };
  const orders = new OrdersService(
    prisma as unknown as PrismaService,
    audit as never,
    mail as never,
    {
      getPlatformInfo: vi.fn(async () => ({
        name: '供应商微平台',
        url: 'http://localhost:3000',
      })),
    } as never,
    storage as never,
  );
  return { orders, createInvoice, prisma, audit, mail, storage };
}

async function expectInvalidState(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrowError(AppException);
  try {
    await promise;
  } catch (error) {
    expect((error as AppException).code).toBe(ErrorCode.INVALID_STATE);
  }
}

describe('OrdersService 订单完成后的提交限制', () => {
  it('已完成订单拒绝提交发票', async () => {
    const { orders, createInvoice } = service('COMPLETED');
    await expectInvalidState(
      orders.supplierSubmitInvoice(
        'o1',
        { invoiceNo: 'INV-1', amount: 100 },
        supplierUser,
      ),
    );
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('已完成订单拒绝上传验收单', async () => {
    const { orders } = service('COMPLETED');
    await expectInvalidState(
      orders.supplierUploadAcceptance(
        'o1',
        { attachmentIds: ['att1'] },
        supplierUser,
      ),
    );
  });

  it('已完成订单拒绝提交合同', async () => {
    const { orders } = service('COMPLETED');
    await expectInvalidState(
      orders.supplierSubmitContract(
        'o1',
        { attachmentIds: ['att1'] },
        supplierUser,
      ),
    );
  });

  it('进行中订单允许提交发票', async () => {
    const { orders, createInvoice } = service('IN_PROGRESS');
    await expect(
      orders.supplierSubmitInvoice(
        'o1',
        { invoiceNo: 'INV-1', amount: 100 },
        supplierUser,
      ),
    ).resolves.toBeUndefined();
    expect(createInvoice).toHaveBeenCalledOnce();
  });
});

describe('OrdersService 列表与状态流转', () => {
  it('列表映射合同/验收状态并限制分页大小', async () => {
    const { orders, prisma } = service('IN_PROGRESS');
    const result = await orders.list({ page: 0, pageSize: 500 });
    expect(result.meta.page).toBe(1);
    expect(result.meta.pageSize).toBe(100);
    expect(result.items[0]).toMatchObject({
      contractStatus: 'SUBMITTED',
      acceptanceStatus: null,
      invoiceCount: 2,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
  });

  it('管理员可完成订单并写审计', async () => {
    const { orders, prisma, audit } = service('IN_PROGRESS');
    await orders.complete('o1', admin);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] } },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.completed' }),
    );
  });

  it('非管理员非创建者不能完成订单', async () => {
    const { orders } = service('IN_PROGRESS');
    await expect(orders.complete('o1', member)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('状态不满足时完成订单返回 INVALID_STATE', async () => {
    const { orders, prisma } = service('COMPLETED');
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(orders.complete('o1', admin)).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE,
    });
  });

  it('取消订单记录原因', async () => {
    const { orders, prisma, audit } = service('PENDING_CONTRACT');
    await orders.cancel('o1', '供应商无法供货', admin);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'order.cancelled',
        afterData: { reason: '供应商无法供货' },
      }),
    );
  });

  it('回传合同必须携带文件', async () => {
    const { orders } = service('IN_PROGRESS');
    await expect(
      orders.returnContract('o1', { attachmentIds: [] }, admin),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('回传合同绑定附件并更新状态', async () => {
    const { orders, prisma, storage } = service('IN_PROGRESS');
    await orders.returnContract(
      'o1',
      { attachmentIds: ['att1'], note: '修订' },
      admin,
    );
    expect(storage.bind).toHaveBeenCalledWith(
      ['att1'],
      'CONTRACT',
      'c1',
      'CONTRACT_FILE',
      { type: 'INTERNAL', id: 'u1' },
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('合同状态不允许时不能标记完成', async () => {
    const { orders } = service('IN_PROGRESS', {
      contract: { id: 'c1', status: 'PENDING_SUBMISSION' },
    });
    await expect(orders.completeContract('o1', admin)).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE,
    });
  });

  it('合同标记完成并推进订单状态', async () => {
    const { orders, prisma, audit } = service('IN_PROGRESS');
    await orders.completeContract('o1', admin);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'contract.completed' }),
    );
  });

  it('未上传验收单时不能签署', async () => {
    const { orders } = service('IN_PROGRESS', { acceptance: null });
    await expect(
      orders.signAcceptance('o1', {}, admin),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
  });

  it('签署验收单绑定签署文件', async () => {
    const { orders, prisma, storage } = service('IN_PROGRESS');
    await orders.signAcceptance('o1', { signedFileId: 'signed1' }, admin);
    expect(storage.bind).toHaveBeenCalledWith(
      ['signed1'],
      'ORDER',
      'o1',
      'SIGNED_ACCEPTANCE',
      { type: 'INTERNAL', id: 'u1' },
    );
    expect(prisma.acceptanceCertificate.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: expect.objectContaining({ status: 'SIGNED', signedFileId: 'signed1' }),
    });
  });

  it('供应商提交合同需上传文件', async () => {
    const { orders } = service('IN_PROGRESS', {
      contract: { id: 'c1', status: 'PENDING_SUBMISSION' },
    });
    await expect(
      orders.supplierSubmitContract('o1', { attachmentIds: [] }, supplierUser),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('非订单供应商提交合同返回 NOT_FOUND', async () => {
    const { orders } = service('IN_PROGRESS');
    await expect(
      orders.supplierSubmitContract(
        'o1',
        { attachmentIds: ['att1'] },
        { ...supplierUser, supplierId: 'sup2' },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('供应商提交合同成功', async () => {
    const { orders, storage, audit } = service('IN_PROGRESS', {
      contract: { id: 'c1', status: 'PENDING_SUBMISSION' },
    });
    await orders.supplierSubmitContract(
      'o1',
      { attachmentIds: ['att1'] },
      supplierUser,
    );
    expect(storage.bind).toHaveBeenCalledWith(
      ['att1'],
      'CONTRACT',
      'c1',
      'CONTRACT_FILE',
      { type: 'SUPPLIER', id: 's1' },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'contract.submitted' }),
    );
  });

  it('验收单已签署时拒绝重新上传', async () => {
    const { orders } = service('IN_PROGRESS', {
      acceptance: { id: 'a1', status: 'SIGNED' },
    });
    await expect(
      orders.supplierUploadAcceptance(
        'o1',
        { attachmentIds: ['att1'] },
        supplierUser,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
  });

  it('首次上传验收单创建记录', async () => {
    const { orders, prisma } = service('IN_PROGRESS', { acceptance: null });
    await orders.supplierUploadAcceptance(
      'o1',
      { attachmentIds: ['att1'] },
      supplierUser,
    );
    expect(prisma.acceptanceCertificate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'o1',
        status: 'UPLOADED',
        supplierFileId: 'att1',
      }),
    });
  });

  it('提交发票时绑定发票与付款申请附件', async () => {
    const { orders, storage } = service('IN_PROGRESS');
    await orders.supplierSubmitInvoice(
      'o1',
      {
        invoiceNo: 'INV-1',
        amount: 100,
        invoiceFileIds: ['f1'],
        paymentRequestFileIds: ['f2'],
      },
      supplierUser,
    );
    expect(storage.bind).toHaveBeenCalledWith(
      ['f1'],
      'INVOICE',
      'inv1',
      'INVOICE_FILE',
      { type: 'SUPPLIER', id: 's1' },
    );
    expect(storage.bind).toHaveBeenCalledWith(
      ['f2'],
      'INVOICE',
      'inv1',
      'PAYMENT_REQUEST',
      { type: 'SUPPLIER', id: 's1' },
    );
  });

  it('供应商列表按自身供应商过滤', async () => {
    const { orders, prisma } = service('IN_PROGRESS');
    await orders.supplierList(supplierUser);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId: 'sup1' },
      }),
    );
  });
});
