import { Injectable } from '@nestjs/common';
import type { Project } from '../../generated/prisma/client.js';
import { AppException } from '../../common/errors/app.exception.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import { generateDailyCode } from '../../common/utils/codes.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  canManage(project: Project, user: InternalAuthUser): boolean {
    return user.role === 'ADMIN' || project.createdByUserId === user.id;
  }

  assertManageable(project: Project, user: InternalAuthUser): void {
    if (!this.canManage(project, user)) {
      throw AppException.forbidden('仅管理员或项目创建者可执行此操作');
    }
  }

  async getOrThrow(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw AppException.notFound('项目不存在');
    }
    return project;
  }

  async getManageable(id: string, user: InternalAuthUser): Promise<Project> {
    const project = await this.getOrThrow(id);
    this.assertManageable(project, user);
    return project;
  }

  async generateCode(): Promise<string> {
    return generateDailyCode('PRJ', async (code) => {
      const exists = await this.prisma.project.findUnique({
        where: { code },
        select: { id: true },
      });
      return Boolean(exists);
    });
  }

  async generateInquiryCode(): Promise<string> {
    return generateDailyCode('INQ', async (code) => {
      const exists = await this.prisma.inquiry.findUnique({
        where: { code },
        select: { id: true },
      });
      return Boolean(exists);
    });
  }

  async detail(id: string, user: InternalAuthUser) {
    const project = await this.getOrThrow(id);

    const [creator, inquiries, orders, invoices] = await Promise.all([
      this.prisma.internalUser.findUnique({
        where: { id: project.createdByUserId },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.inquiry.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { invited: true, quotes: true } },
          order: { select: { id: true, orderNo: true, status: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          contract: { select: { status: true } },
          acceptance: { select: { status: true } },
          _count: { select: { invoices: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { order: { projectId: id } },
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { id: true, orderNo: true } },
        },
      }),
    ]);

    const targetIds = [project.id, ...inquiries.map((row) => row.id), ...orders.map((row) => row.id)];
    const activities = targetIds.length
      ? await this.prisma.auditLog.findMany({
          where: { targetId: { in: targetIds } },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            summary: true,
            actorName: true,
            createdAt: true,
          },
        })
      : [];

    return {
      ...project,
      creatorName: creator?.name ?? null,
      canManage: this.canManage(project, user),
      inquiries: inquiries.map((inquiry) => ({
        ...inquiry,
        invitedCount: inquiry._count.invited,
        quoteCount: inquiry._count.quotes,
        _count: undefined,
      })),
      orders: orders.map((order) => ({
        ...order,
        contractStatus: order.contract?.status ?? null,
        acceptanceStatus: order.acceptance?.status ?? null,
        invoiceCount: order._count.invoices,
        contract: undefined,
        acceptance: undefined,
        _count: undefined,
      })),
      invoices,
      activities,
    };
  }
}
