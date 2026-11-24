import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { SupplierAuthGuard } from '../../common/guards/supplier-auth.guard.js';
import type {
  InternalAuthUser,
  SupplierAuthUser,
} from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('dashboard')
@UseGuards(InternalAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overviewRoot(@CurrentUser() user: InternalAuthUser) {
    return this.overview(user);
  }

  @Get('overview')
  async overview(@CurrentUser() user: InternalAuthUser) {
    const [
      activeProjects,
      openInquiries,
      inProgressOrders,
      pendingContracts,
      pendingAcceptance,
      recentProjects,
      closingInquiries,
    ] = await Promise.all([
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.inquiry.count({ where: { status: 'OPEN' } }),
      this.prisma.order.count({
        where: { status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] } },
      }),
      this.prisma.contract.count({ where: { status: 'PENDING_SUBMISSION' } }),
      this.prisma.acceptanceCertificate.count({
        where: { status: 'UPLOADED' },
      }),
      this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.inquiry.findMany({
        where: { status: 'OPEN' },
        orderBy: { deadline: 'asc' },
        take: 5,
        select: {
          id: true,
          code: true,
          title: true,
          deadline: true,
          project: { select: { id: true, name: true } },
          _count: { select: { quotes: true } },
        },
      }),
    ]);

    return {
      user: { name: user.name, role: user.role },
      stats: {
        activeProjects,
        openInquiries,
        inProgressOrders,
        pendingContracts,
        pendingAcceptance,
      },
      recentProjects,
      closingInquiries,
    };
  }
}

@Controller('supplier/dashboard')
@UseGuards(SupplierAuthGuard)
export class SupplierDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overviewRoot(@CurrentUser() user: SupplierAuthUser) {
    return this.overview(user);
  }

  @Get('overview')
  async overview(@CurrentUser() user: SupplierAuthUser) {
    const supplierId = user.supplierId;
    const [openInvitations, myQuotes, activeOrders, pendingContracts, orders] =
      await Promise.all([
        this.prisma.inquirySupplier.count({
          where: { supplierId, inquiry: { status: 'OPEN' } },
        }),
        this.prisma.quote.count({ where: { supplierId } }),
        this.prisma.order.count({
          where: {
            supplierId,
            status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] },
          },
        }),
        this.prisma.order.count({
          where: {
            supplierId,
            contract: { status: 'PENDING_SUBMISSION' },
          },
        }),
        this.prisma.order.findMany({
          where: { supplierId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNo: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            project: { select: { name: true } },
          },
        }),
      ]);

    return {
      stats: {
        openInvitations,
        myQuotes,
        activeOrders,
        pendingContracts,
      },
      recentOrders: orders,
    };
  }
}
