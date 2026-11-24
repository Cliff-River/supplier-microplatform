import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const supplierUser = {
  id: 's1',
  supplierId: 'sup1',
  name: '供应商',
  email: 's@local.test',
};

function service(status: string): {
  orders: OrdersService;
  createInvoice: ReturnType<typeof vi.fn>;
} {
  const createInvoice = vi.fn(async () => ({
    id: 'inv1',
    orderId: 'o1',
    invoiceNo: 'INV-1',
  }));
  const prisma = {
    order: {
      findUnique: vi.fn(async () => ({
        id: 'o1',
        orderNo: 'ORD-1',
        supplierId: 'sup1',
        status,
        contract: { id: 'c1', status: 'COMPLETED' },
        acceptance: null,
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
      })),
    },
    internalUser: { findUnique: vi.fn(async () => null) },
    supplierUser: { findMany: vi.fn(async () => []) },
    attachment: { findMany: vi.fn(async () => []) },
    invoice: { create: createInvoice },
    acceptanceCertificate: { create: vi.fn(), update: vi.fn() },
  };
  const orders = new OrdersService(
    prisma as unknown as PrismaService,
    { record: vi.fn() } as never,
    { send: vi.fn() } as never,
    {
      getPlatformInfo: vi.fn(async () => ({
        name: '供应商微平台',
        url: 'http://localhost:3000',
      })),
    } as never,
    { bind: vi.fn(), absolutePath: vi.fn() } as never,
  );
  return { orders, createInvoice };
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
