import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../../common/audit/audit.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import type {
  InternalAuthUser,
  SupplierAuthUser,
} from '../../common/types/auth-user.js';
import {
  formatShanghaiDateTime,
  generateDailyCode,
} from '../../common/utils/codes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { MailService } from '../../mail/mail.service.js';
import {
  renderInquiryOpened,
  renderOrderCreated,
} from '../../mail/mail-templates.js';
import { StorageService } from '../../storage/storage.service.js';

export interface InquiryInput {
  title: string;
  description?: string | null;
  quantity: number;
  unit: string;
  deadline: Date;
  invitedSupplierIds?: string[];
  attachmentIds?: string[];
}

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw AppException.notFound('项目不存在');
    }
    return project;
  }

  private assertProjectManageable(
    project: { createdByUserId: string; status: string },
    user: InternalAuthUser,
  ): void {
    if (user.role !== 'ADMIN' && project.createdByUserId !== user.id) {
      throw AppException.forbidden('仅管理员或项目创建者可执行此操作');
    }
    if (project.status === 'ARCHIVED') {
      throw AppException.invalidState('已归档项目不可操作');
    }
  }

  async getInquiryOrThrow(id: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!inquiry) {
      throw AppException.notFound('询价项不存在');
    }
    return inquiry;
  }

  private async assertManageable(id: string, user: InternalAuthUser) {
    const inquiry = await this.getInquiryOrThrow(id);
    this.assertProjectManageable(inquiry.project, user);
    return inquiry;
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

  async createForProject(
    projectId: string,
    input: InquiryInput,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<{ id: string }> {
    const project = await this.getProjectOrThrow(projectId);
    this.assertProjectManageable(project, user);

    if (input.deadline.getTime() <= Date.now()) {
      throw AppException.validation('截止时间必须晚于当前时间');
    }

    const supplierIds = [...new Set(input.invitedSupplierIds ?? [])];
    if (supplierIds.length > 0) {
      const suppliers = await this.prisma.supplier.findMany({
        where: { id: { in: supplierIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      if (suppliers.length !== supplierIds.length) {
        throw AppException.validation('部分供应商不存在或已停用');
      }
    }

    const code = await this.generateInquiryCode();
    const inquiry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        data: {
          code,
          projectId,
          title: input.title,
          description: input.description ?? null,
          quantity: input.quantity,
          unit: input.unit,
          deadline: input.deadline,
          createdByUserId: user.id,
        },
      });
      if (supplierIds.length > 0) {
        await tx.inquirySupplier.createMany({
          data: supplierIds.map((supplierId) => ({
            inquiryId: created.id,
            supplierId,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    if (input.attachmentIds?.length) {
      await this.storage.bind(
        input.attachmentIds,
        'INQUIRY',
        inquiry.id,
        'GENERAL',
        { type: 'INTERNAL', id: user.id },
      );
    }

    await this.audit.record({
      action: 'inquiry.created',
      targetType: 'inquiry',
      targetId: inquiry.id,
      summary: `新增询价项 ${inquiry.title}`,
      actor: user,
      request,
      afterData: { code: inquiry.code, supplierCount: supplierIds.length },
    });

    return { id: inquiry.id };
  }

  async update(
    id: string,
    input: Partial<InquiryInput>,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'DRAFT') {
      throw AppException.invalidState('仅草稿状态的询价项可编辑');
    }
    if (input.deadline && input.deadline.getTime() <= Date.now()) {
      throw AppException.validation('截止时间必须晚于当前时间');
    }

    const supplierIds =
      input.invitedSupplierIds !== undefined
        ? [...new Set(input.invitedSupplierIds)]
        : undefined;
    if (supplierIds?.length) {
      const suppliers = await this.prisma.supplier.findMany({
        where: { id: { in: supplierIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      if (suppliers.length !== supplierIds.length) {
        throw AppException.validation('部分供应商不存在或已停用');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
        },
      });
      if (supplierIds !== undefined) {
        await tx.inquirySupplier.deleteMany({ where: { inquiryId: id } });
        if (supplierIds.length) {
          await tx.inquirySupplier.createMany({
            data: supplierIds.map((supplierId) => ({
              inquiryId: id,
              supplierId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    if (input.attachmentIds?.length) {
      await this.storage.bind(
        input.attachmentIds,
        'INQUIRY',
        id,
        'GENERAL',
        { type: 'INTERNAL', id: user.id },
      );
    }

    await this.audit.record({
      action: 'inquiry.updated',
      targetType: 'inquiry',
      targetId: id,
      summary: `更新询价项 ${inquiry.title}`,
      actor: user,
      request,
    });
  }

  async remove(
    id: string,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<{ id: string }> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'DRAFT') {
      throw AppException.invalidState('仅草稿状态的询价项可删除');
    }
    await this.prisma.inquiry.delete({ where: { id } });
    await this.audit.record({
      action: 'inquiry.deleted',
      targetType: 'inquiry',
      targetId: id,
      summary: `删除询价项 ${inquiry.title}`,
      actor: user,
      request,
    });
    return { id };
  }

  async listByProject(projectId: string) {
    await this.getProjectOrThrow(projectId);
    const inquiries = await this.prisma.inquiry.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { invited: true, quotes: true } },
        order: { select: { id: true, orderNo: true, status: true } },
      },
    });
    return inquiries.map((inquiry) => ({
      ...inquiry,
      invitedCount: inquiry._count.invited,
      quoteCount: inquiry._count.quotes,
      _count: undefined,
    }));
  }

  async detail(id: string) {
    const inquiry = await this.getInquiryOrThrow(id);

    const [invited, quotes, attachments] = await Promise.all([
      this.prisma.inquirySupplier.findMany({
        where: { inquiryId: id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              ratingAvg: true,
              ratingCount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.quote.findMany({
        where: { inquiryId: id },
        include: { supplier: { select: { id: true, name: true, code: true, ratingAvg: true } } },
        orderBy: { totalPrice: 'asc' },
      }),
      this.prisma.attachment.findMany({
        where: { scope: 'INQUIRY', scopeId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const quoteIds = quotes.map((row) => row.id);
    const quoteAttachments = quoteIds.length
      ? await this.prisma.attachment.findMany({
          where: { scope: 'QUOTE', scopeId: { in: quoteIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const attachmentMap = new Map<string, typeof quoteAttachments>();
    for (const file of quoteAttachments) {
      const key = file.scopeId ?? '';
      const list = attachmentMap.get(key) ?? [];
      list.push(file);
      attachmentMap.set(key, list);
    }

    return {
      ...inquiry,
      invited,
      quotes: quotes.map((quote) => ({
        ...quote,
        attachments: attachmentMap.get(quote.id) ?? [],
      })),
      attachments,
    };
  }

  /** 发送询价邮件：DRAFT -> OPEN */
  async send(
    id: string,
    user: InternalAuthUser,
    request?: Request,
    supplierIds?: string[],
  ): Promise<{ sent: number; failed: number }> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'DRAFT') {
      throw AppException.invalidState('仅草稿状态的询价项可发送');
    }
    if (inquiry.deadline.getTime() <= Date.now()) {
      throw AppException.invalidState('截止时间已过，请调整截止时间后重试');
    }
    const invited = await this.prisma.inquirySupplier.findMany({
      where: { inquiryId: id },
    });
    if (invited.length === 0) {
      throw AppException.validation('请先选择受邀供应商');
    }

    const result = await this.prisma.inquiry.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: 'OPEN', openedAt: new Date() },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('询价项状态已变化，请刷新后重试');
    }

    await this.audit.record({
      action: 'inquiry.opened',
      targetType: 'inquiry',
      targetId: id,
      summary: `发送询价 ${inquiry.title}`,
      actor: user,
      request,
      afterData: { supplierCount: invited.length },
    });

    const targets = supplierIds?.length
      ? invited.filter((row) => supplierIds.includes(row.supplierId))
      : invited;
    return this.sendInvites(id, targets);
  }

  async close(
    id: string,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'OPEN') {
      throw AppException.invalidState('仅开放中的询价项可关闭');
    }
    const result = await this.prisma.inquiry.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('询价项状态已变化，请刷新后重试');
    }
    await this.audit.record({
      action: 'inquiry.closed',
      targetType: 'inquiry',
      targetId: id,
      summary: `关闭询价 ${inquiry.title}`,
      actor: user,
      request,
    });
  }

  async reopen(
    id: string,
    deadline: Date,
    resend: boolean,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<{ sent: number; failed: number } | null> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'CLOSED') {
      throw AppException.invalidState('仅已关闭的询价项可重新开放');
    }
    if (deadline.getTime() <= Date.now()) {
      throw AppException.validation('截止时间必须晚于当前时间');
    }
    const result = await this.prisma.inquiry.updateMany({
      where: { id, status: 'CLOSED' },
      data: { status: 'OPEN', deadline, openedAt: new Date(), closedAt: null },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('询价项状态已变化，请刷新后重试');
    }
    await this.audit.record({
      action: 'inquiry.reopened',
      targetType: 'inquiry',
      targetId: id,
      summary: `重新开放询价 ${inquiry.title}`,
      actor: user,
      request,
      afterData: { deadline },
    });
    if (!resend) return null;
    const invited = await this.prisma.inquirySupplier.findMany({
      where: { inquiryId: id },
    });
    return this.sendInvites(id, invited);
  }

  async cancel(
    id: string,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const inquiry = await this.assertManageable(id, user);
    if (!['DRAFT', 'CLOSED'].includes(inquiry.status)) {
      throw AppException.invalidState('当前状态不可作废');
    }
    const result = await this.prisma.inquiry.updateMany({
      where: { id, status: { in: ['DRAFT', 'CLOSED'] } },
      data: { status: 'CANCELLED' },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('询价项状态已变化，请刷新后重试');
    }
    await this.audit.record({
      action: 'inquiry.cancelled',
      targetType: 'inquiry',
      targetId: id,
      summary: `作废询价 ${inquiry.title}`,
      actor: user,
      request,
    });
  }

  async resend(
    id: string,
    supplierIds: string[] | undefined,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<{ sent: number; failed: number }> {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'OPEN') {
      throw AppException.invalidState('仅开放中的询价项可重发邮件');
    }
    const invited = await this.prisma.inquirySupplier.findMany({
      where: {
        inquiryId: id,
        ...(supplierIds?.length ? { supplierId: { in: supplierIds } } : {}),
      },
    });
    if (invited.length === 0) {
      throw AppException.validation('没有可重发的受邀供应商');
    }
    await this.audit.record({
      action: 'inquiry.mail_resent',
      targetType: 'inquiry',
      targetId: id,
      summary: `重发询价邮件（${invited.length} 家）`,
      actor: user,
      request,
    });
    return this.sendInvites(id, invited);
  }

  /** 选标并生成订单（本期一标一单） */
  async award(
    id: string,
    supplierId: string,
    user: InternalAuthUser,
    request?: Request,
  ) {
    const inquiry = await this.assertManageable(id, user);
    if (inquiry.status !== 'CLOSED') {
      throw AppException.invalidState('仅已关闭的询价项可选标');
    }
    const quote = await this.prisma.quote.findUnique({
      where: { inquiryId_supplierId: { inquiryId: id, supplierId } },
    });
    if (!quote) {
      throw AppException.validation('该供应商尚未提交报价');
    }
    const orderNo = await generateDailyCode('ORD', async (code) => {
      const exists = await this.prisma.order.findUnique({
        where: { orderNo: code },
        select: { id: true },
      });
      return Boolean(exists);
    });

    let order: { id: string; orderNo: string };
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.inquiry.updateMany({
          where: { id, status: 'CLOSED' },
          data: { status: 'AWARDED', awardedAt: new Date() },
        });
        if (updated.count !== 1) {
          throw AppException.invalidState('询价项状态已变化，可能已被选标');
        }
        const created = await tx.order.create({
          data: {
            orderNo,
            projectId: inquiry.projectId,
            inquiryId: id,
            supplierId,
            quoteId: quote.id,
            amount: quote.totalPrice,
            currency: quote.currency,
            status: 'PENDING_CONTRACT',
            createdByUserId: user.id,
          },
        });
        await tx.contract.create({ data: { orderId: created.id } });
        return created;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw AppException.invalidState('该询价项已生成订单，请勿重复选标');
      }
      throw error;
    }

    await this.audit.record({
      action: 'inquiry.awarded',
      targetType: 'inquiry',
      targetId: id,
      summary: `选定供应商并生成订单 ${order.orderNo}`,
      actor: user,
      request,
      afterData: { supplierId, orderId: order.id, amount: quote.totalPrice.toString() },
    });

    await this.sendOrderCreated(order.id).catch((error: unknown) => {
      this.logger.error(
        `订单邮件发送失败 ${order.orderNo}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return this.prisma.order.findUnique({
      where: { id: order.id },
      include: { contract: true },
    });
  }

  /** 到期自动关闭 */
  async closeExpired(): Promise<number> {
    const expired = await this.prisma.inquiry.findMany({
      where: { status: 'OPEN', deadline: { lte: new Date() } },
      select: { id: true, title: true },
    });
    if (expired.length === 0) return 0;
    await this.prisma.inquiry.updateMany({
      where: { id: { in: expired.map((row) => row.id) }, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    for (const row of expired) {
      await this.audit.record({
        action: 'inquiry.auto_closed',
        targetType: 'inquiry',
        targetId: row.id,
        summary: `询价 ${row.title} 到期自动关闭`,
        actor: { kind: 'SYSTEM', name: '系统定时任务' },
      });
    }
    return expired.length;
  }

  private async sendInvites(
    inquiryId: string,
    targets: Array<{ id: string; supplierId: string }>,
  ): Promise<{ sent: number; failed: number }> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { project: true },
    });
    if (!inquiry) throw AppException.notFound('询价项不存在');

    const [platform, attachments] = await Promise.all([
      this.settings.getPlatformInfo(),
      this.prisma.attachment.findMany({
        where: { scope: 'INQUIRY', scopeId: inquiryId },
      }),
    ]);

    let sent = 0;
    let failed = 0;
    for (const target of targets) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: target.supplierId },
        select: { name: true },
      });
      const users = await this.prisma.supplierUser.findMany({
        where: {
          supplierId: target.supplierId,
          isActive: true,
          deletedAt: null,
        },
        select: { email: true },
      });
      const emails = users.map((row) => row.email);
      if (emails.length === 0) {
        failed += 1;
        await this.prisma.inquirySupplier.update({
          where: { id: target.id },
          data: {
            mailStatus: 'FAILED',
            mailError: '该供应商暂无可用账号邮箱',
          },
        });
        continue;
      }

      const rendered = renderInquiryOpened(
        { appName: platform.name, appUrl: platform.url },
        {
          projectName: inquiry.project.name,
          projectCode: inquiry.project.code,
          inquiryTitle: inquiry.title,
          description: inquiry.description,
          quantity: inquiry.quantity.toString(),
          unit: inquiry.unit,
          deadline: formatShanghaiDateTime(inquiry.deadline),
          inquiryUrl: `${platform.url}/supplier/inquiries/${inquiry.id}`,
          supplierName: supplier?.name ?? '供应商',
          contactName: inquiry.project.contactName,
          contactPhone: inquiry.project.contactPhone ?? undefined,
          contactEmail: inquiry.project.contactEmail,
        },
      );

      const result = await this.mail.send({
        templateKey: 'inquiry.opened',
        to: emails,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        relatedType: 'inquiry',
        relatedId: inquiry.id,
        attachments: attachments.map((file) => ({
          filename: file.fileName,
          path: this.storage.absolutePath(file.storageKey),
          contentType: file.mimeType,
        })),
      });

      if (result?.status === 'SENT') {
        sent += 1;
        await this.prisma.inquirySupplier.update({
          where: { id: target.id },
          data: { mailStatus: 'SENT', mailError: null, sentAt: new Date() },
        });
      } else {
        failed += 1;
        await this.prisma.inquirySupplier.update({
          where: { id: target.id },
          data: {
            mailStatus: 'FAILED',
            mailError: '邮件发送失败，可在详情页重发',
          },
        });
      }
    }
    return { sent, failed };
  }

  private async sendOrderCreated(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        project: true,
        inquiry: true,
        supplier: { select: { name: true } },
      },
    });
    if (!order) return;
    const platform = await this.settings.getPlatformInfo();
    const users = await this.prisma.supplierUser.findMany({
      where: { supplierId: order.supplierId, isActive: true, deletedAt: null },
      select: { email: true },
    });
    if (users.length === 0) return;

    const rendered = renderOrderCreated(
      { appName: platform.name, appUrl: platform.url },
      {
        orderNo: order.orderNo,
        projectName: order.project.name,
        inquiryTitle: order.inquiry.title,
        amount: Number(order.amount).toFixed(2),
        currency: order.currency,
        orderUrl: `${platform.url}/supplier/orders/${order.id}`,
        supplierName: order.supplier.name,
        contactName: order.project.contactName,
        contactPhone: order.project.contactPhone ?? undefined,
        contactEmail: order.project.contactEmail,
      },
    );
    await this.mail.send({
      templateKey: 'order.created',
      to: users.map((row) => row.email),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  /** 供应商可见的开放询价 */
  async supplierList(user: SupplierAuthUser) {
    const rows = await this.prisma.inquirySupplier.findMany({
      where: { supplierId: user.supplierId, inquiry: { status: 'OPEN' } },
      include: {
        inquiry: {
          include: {
            project: { select: { id: true, name: true, code: true } },
            quotes: {
              where: { supplierId: user.supplierId },
              select: { id: true, version: true, submittedAt: true },
            },
            _count: { select: { invited: true } },
          },
        },
      },
      orderBy: { inquiry: { deadline: 'asc' } },
    });
    return rows.map((row) => ({
      ...row.inquiry,
      invitedCount: row.inquiry._count.invited,
      myQuote: row.inquiry.quotes[0] ?? null,
      quotes: undefined,
      _count: undefined,
      mailStatus: row.mailStatus,
    }));
  }

  async supplierDetail(id: string, user: SupplierAuthUser) {
    const invite = await this.prisma.inquirySupplier.findUnique({
      where: {
        inquiryId_supplierId: { inquiryId: id, supplierId: user.supplierId },
      },
    });
    if (!invite) {
      throw AppException.notFound('询价项不存在或未被邀请');
    }
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
        quotes: {
          where: { supplierId: user.supplierId },
          include: {
            order: { select: { id: true, orderNo: true } },
          },
        },
        order: { select: { id: true, orderNo: true, status: true } },
      },
    });
    if (!inquiry) {
      throw AppException.notFound('询价项不存在');
    }

    const [attachments, quoteAttachments] = await Promise.all([
      this.prisma.attachment.findMany({
        where: { scope: 'INQUIRY', scopeId: id },
      }),
      inquiry.quotes[0]
        ? this.prisma.attachment.findMany({
            where: { scope: 'QUOTE', scopeId: inquiry.quotes[0].id },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      ...inquiry,
      myQuote: inquiry.quotes[0]
        ? { ...inquiry.quotes[0], attachments: quoteAttachments }
        : null,
      quotes: undefined,
      attachments,
      readOnly: inquiry.status !== 'OPEN',
      canQuote: inquiry.status === 'OPEN' && inquiry.deadline.getTime() > Date.now(),
    };
  }

  /** 供应商历史报价（只读） */
  async supplierQuoteHistory(user: SupplierAuthUser) {
    const quotes = await this.prisma.quote.findMany({
      where: { supplierId: user.supplierId },
      include: {
        inquiry: {
          include: {
            project: { select: { id: true, name: true, code: true } },
            order: { select: { id: true, orderNo: true, status: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return quotes.map((quote) => ({
      id: quote.id,
      unitPrice: quote.unitPrice,
      totalPrice: quote.totalPrice,
      currency: quote.currency,
      deliveryDays: quote.deliveryDays,
      validUntil: quote.validUntil,
      note: quote.note,
      version: quote.version,
      submittedAt: quote.submittedAt,
      updatedAt: quote.updatedAt,
      inquiry: {
        id: quote.inquiry.id,
        code: quote.inquiry.code,
        title: quote.inquiry.title,
        status: quote.inquiry.status,
        deadline: quote.inquiry.deadline,
        project: quote.inquiry.project,
        order: quote.inquiry.order,
      },
    }));
  }
}
