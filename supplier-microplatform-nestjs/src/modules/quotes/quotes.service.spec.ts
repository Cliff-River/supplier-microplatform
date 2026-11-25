import { describe, expect, it, vi } from 'vitest';
import { QuotesService } from './quotes.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SupplierAuthUser } from '../../common/types/auth-user.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const supplierUser: SupplierAuthUser = {
  id: 's1',
  supplierId: 'sup1',
  name: '供应商',
  email: 's@local.test',
};

const inquiry = {
  id: 'i1',
  projectId: 'p1',
  title: '询价一',
  status: 'OPEN',
  deadline: new Date(Date.now() + 60 * 60 * 1000),
  quantity: 10,
  unit: '件',
  code: 'INQ-1',
  project: {
    id: 'p1',
    name: '项目',
    code: 'PRJ-1',
    contactName: '联系人',
    contactEmail: 'contact@local.test',
    contactPhone: null,
    createdByUserId: 'u1',
  },
};

const detailQuote = {
  id: 'q1',
  inquiryId: 'i1',
  supplierId: 'sup1',
  unitPrice: 10,
  totalPrice: 100,
  currency: 'CNY',
  deliveryDays: 5,
  validUntil: null,
  note: null,
  version: 1,
  submittedAt: new Date(),
  supplier: { id: 'sup1', name: '供应商A', code: 'SUP-1', ratingAvg: 5 },
  inquiry,
};

function service(options: {
  inquiry?: Record<string, unknown> | null;
  invite?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  quotes?: Array<Record<string, unknown>>;
} = {}) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...detailQuote,
    ...data,
    unitPrice: data.unitPrice,
  }));
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...detailQuote,
    ...data,
  }));
  const quoteFindUnique = vi.fn(
    async (args: { where: Record<string, unknown> }) => {
      if ('inquiryId_supplierId' in args.where) {
        return options.existing ?? null;
      }
      return detailQuote;
    },
  );
  const prisma = {
    inquiry: {
      findUnique: vi.fn(async () =>
        'inquiry' in options ? options.inquiry : inquiry,
      ),
    },
    inquirySupplier: {
      findUnique: vi.fn(async () =>
        'invite' in options ? options.invite : { id: 'inv1' },
      ),
    },
    quote: {
      findUnique: quoteFindUnique,
      findMany: vi.fn(async () => options.quotes ?? []),
      create,
      update,
    },
    attachment: { findMany: vi.fn(async () => []) },
    internalUser: {
      findUnique: vi.fn(async () => ({ email: 'creator@local.test' })),
    },
  };
  const audit = { record: vi.fn(async () => undefined) };
  const mail = { send: vi.fn(async () => undefined) };
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
  const quotes = new QuotesService(
    prisma as unknown as PrismaService,
    audit as never,
    mail as never,
    settings as never,
    storage as never,
  );
  return { quotes, prisma, create, update, audit, mail, storage };
}

describe('QuotesService.submitQuote 校验', () => {
  it('询价不存在返回 NOT_FOUND', async () => {
    const { quotes } = service({ inquiry: null });
    await expect(
      quotes.submitQuote('missing', supplierUser, { unitPrice: 1 }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('询价已关闭返回 INVALID_STATE', async () => {
    const { quotes } = service({ inquiry: { ...inquiry, status: 'CLOSED' } });
    await expect(
      quotes.submitQuote('i1', supplierUser, { unitPrice: 1 }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
  });

  it('超过截止时间返回 INVALID_STATE', async () => {
    const { quotes } = service({
      inquiry: { ...inquiry, deadline: new Date(Date.now() - 1000) },
    });
    await expect(
      quotes.submitQuote('i1', supplierUser, { unitPrice: 1 }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
  });

  it('未被邀请返回 FORBIDDEN', async () => {
    const { quotes } = service({ invite: null });
    await expect(
      quotes.submitQuote('i1', supplierUser, { unitPrice: 1 }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

describe('QuotesService.submitQuote 写入', () => {
  it('首次报价创建版本 1 并按数量计算总价', async () => {
    const { quotes, create, audit } = service();
    await quotes.submitQuote('i1', supplierUser, { unitPrice: 12.5 });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inquiryId: 'i1',
        supplierId: 'sup1',
        unitPrice: 12.5,
        totalPrice: 125,
        version: 1,
        currency: 'CNY',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'quote.submitted',
        targetType: 'quote',
      }),
    );
  });

  it('再次报价版本递增并绑定附件', async () => {
    const { quotes, update, storage } = service({
      existing: { ...detailQuote, id: 'q1', version: 2 },
    });
    await quotes.submitQuote('i1', supplierUser, {
      unitPrice: 20,
      attachmentIds: ['att1'],
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: expect.objectContaining({ version: 3, totalPrice: 200 }),
    });
    expect(storage.bind).toHaveBeenCalledWith(
      ['att1'],
      'QUOTE',
      'q1',
      'QUOTE_FILE',
      { type: 'SUPPLIER', id: 's1' },
    );
  });
});

describe('QuotesService.listForInquiry', () => {
  it('标记最低总价与最短交期', async () => {
    const { quotes } = service({
      quotes: [
        {
          ...detailQuote,
          id: 'q1',
          totalPrice: 100,
          deliveryDays: 8,
          supplier: { id: 'sup1', name: 'A', code: 'S1', ratingAvg: 4 },
        },
        {
          ...detailQuote,
          id: 'q2',
          totalPrice: 80,
          deliveryDays: 3,
          supplier: { id: 'sup2', name: 'B', code: 'S2', ratingAvg: 5 },
        },
      ],
    });
    const result = await quotes.listForInquiry('i1');
    const first = result.items[0]!;
    const second = result.items[1]!;
    expect(first.isLowestTotal).toBe(false);
    expect(second.isLowestTotal).toBe(true);
    expect(second.isFastest).toBe(true);
    expect(first.isFastest).toBe(false);
  });

  it('询价不存在返回 NOT_FOUND', async () => {
    const { quotes } = service({ inquiry: null });
    await expect(quotes.listForInquiry('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});

describe('QuotesService.exportInquiryQuotes', () => {
  it('生成 Excel 文件内容', async () => {
    const { quotes } = service({
      quotes: [
        {
          ...detailQuote,
          supplier: { id: 'sup1', name: 'A', code: 'S1', ratingAvg: 4 },
        },
      ],
    });
    const result = await quotes.exportInquiryQuotes('i1');
    expect(result.fileName).toBe('报价对比-INQ-1.xlsx');
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
