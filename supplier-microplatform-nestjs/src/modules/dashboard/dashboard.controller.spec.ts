import { describe, expect, it, vi } from 'vitest';
import {
  DashboardController,
  SupplierDashboardController,
} from './dashboard.controller.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function prismaMock() {
  return {
    project: {
      count: vi.fn(async () => 4),
      findMany: vi.fn(async () => [{ id: 'p1', code: 'PRJ-1', name: '项目' }]),
    },
    inquiry: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(async () => [
        {
          id: 'i1',
          code: 'INQ-1',
          title: '询价',
          deadline: new Date(),
          project: { id: 'p1', name: '项目' },
          _count: { quotes: 3 },
        },
      ]),
    },
    order: {
      count: vi.fn(async () => 5),
      findMany: vi.fn(async () => [
        { id: 'o1', orderNo: 'ORD-1', project: { name: '项目' } },
      ]),
    },
    contract: { count: vi.fn(async () => 1) },
    acceptanceCertificate: { count: vi.fn(async () => 2) },
    inquirySupplier: { count: vi.fn(async () => 6) },
    quote: { count: vi.fn(async () => 7) },
  };
}

describe('DashboardController', () => {
  it('返回内部工作台统计与最近数据', async () => {
    const prisma = prismaMock();
    const controller = new DashboardController(prisma as unknown as PrismaService);
    const result = await controller.overview({
      id: 'u1',
      name: '管理员',
      email: 'a@local.test',
      role: 'ADMIN',
    });

    expect(result.user).toEqual({ name: '管理员', role: 'ADMIN' });
    expect(result.stats).toEqual({
      activeProjects: 4,
      openInquiries: 2,
      inProgressOrders: 5,
      pendingContracts: 1,
      pendingAcceptance: 2,
    });
    expect(result.closingInquiries[0]?._count.quotes).toBe(3);
  });

  it('供应商工作台按 supplierId 过滤', async () => {
    const prisma = prismaMock();
    const controller = new SupplierDashboardController(
      prisma as unknown as PrismaService,
    );
    const result = await controller.overview({
      id: 's1',
      supplierId: 'sup1',
      name: '供应商',
      email: 's@local.test',
    });

    expect(result.stats).toEqual({
      openInvitations: 6,
      myQuotes: 7,
      activeOrders: 5,
      pendingContracts: 5,
    });
    expect(prisma.inquirySupplier.count).toHaveBeenCalledWith({
      where: { supplierId: 'sup1', inquiry: { status: 'OPEN' } },
    });
  });
});
