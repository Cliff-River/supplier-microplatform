import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../../common/audit/audit.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import type {
  InternalAuthUser,
  SupplierAuthUser,
} from '../../common/types/auth-user.js';
import { MailService } from '../../mail/mail.service.js';
import {
  renderAcceptanceSigned,
  renderAcceptanceUploaded,
  renderContractReturned,
  renderContractSubmitted,
  renderInvoiceSubmitted,
} from '../../mail/mail-templates.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from '../../storage/storage.service.js';

const INTERNAL_RECIPIENTS_QUERY = {
  project: {
    select: {
      id: true,
      name: true,
      code: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      createdByUserId: true,
    },
  },
  supplier: { select: { id: true, name: true } },
  inquiry: { select: { id: true, title: true } },
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  private async getOrderOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...INTERNAL_RECIPIENTS_QUERY,
        contract: true,
        acceptance: true,
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) {
      throw AppException.notFound('订单不存在');
    }
    return order;
  }

  private assertManageable(
    order: { project: { createdByUserId: string } },
    user: InternalAuthUser,
  ): void {
    if (user.role !== 'ADMIN' && order.project.createdByUserId !== user.id) {
      throw AppException.forbidden('仅管理员或项目创建者可执行此操作');
    }
  }

  async list(query: {
    keyword?: string;
    status?: string;
    projectId?: string;
    supplierId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(Math.max(1, Number(query.pageSize ?? 20) || 20), 100);
    const where = {
      AND: [
        ...(query.status ? [{ status: query.status as never }] : []),
        ...(query.projectId ? [{ projectId: query.projectId }] : []),
        ...(query.supplierId ? [{ supplierId: query.supplierId }] : []),
        ...(query.keyword
          ? [
              {
                OR: [
                  {
                    orderNo: {
                      contains: query.keyword,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    project: {
                      name: {
                        contains: query.keyword,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    supplier: {
                      name: {
                        contains: query.keyword,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true, code: true } },
          inquiry: { select: { id: true, title: true } },
          supplier: { select: { id: true, name: true } },
          contract: { select: { status: true } },
          acceptance: { select: { status: true } },
          _count: { select: { invoices: true } },
        },
      }),
    ]);

    return {
      items: orders.map((order) => ({
        ...order,
        contractStatus: order.contract?.status ?? null,
        acceptanceStatus: order.acceptance?.status ?? null,
        invoiceCount: order._count.invoices,
        contract: undefined,
        acceptance: undefined,
        _count: undefined,
      })),
      meta: { page, pageSize, total },
    };
  }

  async detail(id: string) {
    const order = await this.getOrderOrThrow(id);

    const [creator, contractFiles, invoiceAttachments, acceptanceFiles] =
      await Promise.all([
        this.prisma.internalUser.findUnique({
          where: { id: order.createdByUserId },
          select: { id: true, name: true },
        }),
        order.contract
          ? this.prisma.contractFile.findMany({
              where: { contractId: order.contract.id },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
        order.invoices.length
          ? this.prisma.attachment.findMany({
              where: {
                scope: 'INVOICE',
                scopeId: { in: order.invoices.map((row) => row.id) },
              },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
        order.acceptance
          ? this.prisma.attachment.findMany({
              where: {
                id: {
                  in: [
                    order.acceptance.supplierFileId,
                    ...(order.acceptance.signedFileId
                      ? [order.acceptance.signedFileId]
                      : []),
                  ],
                },
              },
            })
          : Promise.resolve([]),
      ]);

    const contractAttachmentIds = contractFiles.map((file) => file.attachmentId);
    const contractAttachments = contractAttachmentIds.length
      ? await this.prisma.attachment.findMany({
          where: { id: { in: contractAttachmentIds } },
        })
      : [];
    const contractAttachmentMap = new Map(
      contractAttachments.map((file) => [file.id, file]),
    );

    const invoiceMap = new Map<string, typeof invoiceAttachments>();
    for (const file of invoiceAttachments) {
      const key = file.scopeId ?? '';
      const list = invoiceMap.get(key) ?? [];
      list.push(file);
      invoiceMap.set(key, list);
    }

    const acceptanceAttachmentMap = new Map(
      acceptanceFiles.map((file) => [file.id, file]),
    );

    return {
      ...order,
      creatorName: creator?.name ?? null,
      contract: order.contract
        ? {
            ...order.contract,
            files: contractFiles.map((file) => ({
              ...file,
              attachment: contractAttachmentMap.get(file.attachmentId) ?? null,
            })),
          }
        : null,
      acceptance: order.acceptance
        ? {
            ...order.acceptance,
            supplierFile:
              acceptanceAttachmentMap.get(order.acceptance.supplierFileId) ??
              null,
            signedFile: order.acceptance.signedFileId
              ? acceptanceAttachmentMap.get(order.acceptance.signedFileId) ??
                null
              : null,
          }
        : null,
      invoices: order.invoices.map((invoice) => ({
        ...invoice,
        attachments: invoiceMap.get(invoice.id) ?? [],
      })),
    };
  }

  async complete(
    id: string,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    this.assertManageable(order, user);
    const result = await this.prisma.order.updateMany({
      where: { id, status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('当前订单状态不可完成');
    }
    await this.audit.record({
      action: 'order.completed',
      targetType: 'order',
      targetId: id,
      summary: `完成订单 ${order.orderNo}`,
      actor: user,
      request,
    });
  }

  async cancel(
    id: string,
    reason: string | null | undefined,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    this.assertManageable(order, user);
    const result = await this.prisma.order.updateMany({
      where: { id, status: { in: ['PENDING_CONTRACT', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED' },
    });
    if (result.count !== 1) {
      throw AppException.invalidState('当前订单状态不可取消');
    }
    await this.audit.record({
      action: 'order.cancelled',
      targetType: 'order',
      targetId: id,
      summary: `取消订单 ${order.orderNo}${reason ? `：${reason}` : ''}`,
      actor: user,
      request,
      afterData: { reason: reason ?? null },
    });
  }

  async returnContract(
    id: string,
    input: { note?: string | null; attachmentIds: string[] },
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    this.assertManageable(order, user);
    if (!order.contract) {
      throw AppException.invalidState('订单合同不存在');
    }
    if (order.contract.status !== 'SUBMITTED') {
      throw AppException.invalidState('仅待审核的合同可回传修订版');
    }
    if (!input.attachmentIds.length) {
      throw AppException.validation('请上传修订版合同文件');
    }

    await this.storage.bind(
      input.attachmentIds,
      'CONTRACT',
      order.contract.id,
      'CONTRACT_FILE',
      { type: 'INTERNAL', id: user.id },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.contractFile.createMany({
        data: input.attachmentIds.map((attachmentId) => ({
          contractId: order.contract!.id,
          attachmentId,
          direction: 'INTERNAL',
          note: input.note ?? null,
          uploadedByType: 'INTERNAL',
          uploadedById: user.id,
        })),
      });
      await tx.contract.update({
        where: { id: order.contract!.id },
        data: { status: 'RETURNED', returnedAt: new Date() },
      });
    });

    await this.audit.record({
      action: 'contract.returned',
      targetType: 'order',
      targetId: id,
      summary: `回传修订版合同（订单 ${order.orderNo}）`,
      actor: user,
      request,
    });

    await this.mailSupplierContract(id, 'contract.returned', input.attachmentIds).catch(
      (error: unknown) => this.logMailError('合同回传', error),
    );
  }

  async completeContract(
    id: string,
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    this.assertManageable(order, user);
    if (!order.contract) {
      throw AppException.invalidState('订单合同不存在');
    }
    if (!['SUBMITTED', 'RETURNED'].includes(order.contract.status)) {
      throw AppException.invalidState('当前合同状态不可标记完成');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: order.contract!.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.order.updateMany({
        where: { id, status: 'PENDING_CONTRACT' },
        data: { status: 'IN_PROGRESS' },
      });
    });
    await this.audit.record({
      action: 'contract.completed',
      targetType: 'order',
      targetId: id,
      summary: `合同签署完成（订单 ${order.orderNo}）`,
      actor: user,
      request,
    });
  }

  async signAcceptance(
    id: string,
    input: { signedFileId?: string | null },
    user: InternalAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    this.assertManageable(order, user);
    if (!order.acceptance) {
      throw AppException.invalidState('供应商尚未上传验收单');
    }
    if (order.acceptance.status !== 'UPLOADED') {
      throw AppException.invalidState('验收单已签署');
    }

    if (input.signedFileId) {
      await this.storage.bind(
        [input.signedFileId],
        'ORDER',
        id,
        'SIGNED_ACCEPTANCE',
        { type: 'INTERNAL', id: user.id },
      );
    }

    await this.prisma.acceptanceCertificate.update({
      where: { id: order.acceptance.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signedByUserId: user.id,
        signedFileId: input.signedFileId ?? null,
      },
    });

    await this.audit.record({
      action: 'acceptance.signed',
      targetType: 'order',
      targetId: id,
      summary: `签署验收单（订单 ${order.orderNo}）`,
      actor: user,
      request,
    });

    await this.mailSupplierContract(
      id,
      'acceptance.signed',
      input.signedFileId ? [input.signedFileId] : [order.acceptance.supplierFileId],
    ).catch((error: unknown) => this.logMailError('验收单签署', error));
  }

  async supplierList(user: SupplierAuthUser) {
    const orders = await this.prisma.order.findMany({
      where: { supplierId: user.supplierId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true, code: true } },
        inquiry: { select: { id: true, title: true } },
        contract: { select: { status: true } },
        acceptance: { select: { status: true } },
        _count: { select: { invoices: true } },
      },
    });
    return orders.map((order) => ({
      ...order,
      contractStatus: order.contract?.status ?? null,
      acceptanceStatus: order.acceptance?.status ?? null,
      invoiceCount: order._count.invoices,
      contract: undefined,
      acceptance: undefined,
      _count: undefined,
    }));
  }

  async supplierDetail(id: string, user: SupplierAuthUser) {
    const order = await this.getOrderOrThrow(id);
    if (order.supplierId !== user.supplierId) {
      throw AppException.notFound('订单不存在');
    }
    return this.detail(id);
  }

  async supplierSubmitContract(
    id: string,
    input: { note?: string | null; attachmentIds: string[] },
    user: SupplierAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    if (order.supplierId !== user.supplierId) {
      throw AppException.notFound('订单不存在');
    }
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw AppException.invalidState('订单已结束，无法提交合同');
    }
    if (!order.contract) {
      throw AppException.invalidState('订单合同不存在');
    }
    if (!['PENDING_SUBMISSION', 'RETURNED'].includes(order.contract.status)) {
      throw AppException.invalidState('当前合同状态不可提交');
    }
    if (!input.attachmentIds.length) {
      throw AppException.validation('请上传合同文件');
    }

    await this.storage.bind(
      input.attachmentIds,
      'CONTRACT',
      order.contract.id,
      'CONTRACT_FILE',
      { type: 'SUPPLIER', id: user.id },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.contractFile.createMany({
        data: input.attachmentIds.map((attachmentId) => ({
          contractId: order.contract!.id,
          attachmentId,
          direction: 'SUPPLIER',
          note: input.note ?? null,
          uploadedByType: 'SUPPLIER',
          uploadedById: user.id,
        })),
      });
      await tx.contract.update({
        where: { id: order.contract!.id },
        data: {
          status: 'SUBMITTED',
          supplierNote: input.note ?? null,
          submittedAt: new Date(),
        },
      });
    });

    await this.audit.record({
      action: 'contract.submitted',
      targetType: 'order',
      targetId: id,
      summary: `供应商提交合同（订单 ${order.orderNo}）`,
      actor: user,
      request,
    });

    await this.mailInternalContract(id, 'contract.submitted', input.attachmentIds).catch(
      (error: unknown) => this.logMailError('合同提交', error),
    );
  }

  async supplierUploadAcceptance(
    id: string,
    input: { attachmentIds: string[] },
    user: SupplierAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    if (order.supplierId !== user.supplierId) {
      throw AppException.notFound('订单不存在');
    }
    if (order.status === 'CANCELLED') {
      throw AppException.invalidState('订单已取消');
    }
    if (order.status === 'COMPLETED') {
      throw AppException.invalidState('订单已完成，无法上传验收单');
    }
    if (order.acceptance?.status === 'SIGNED') {
      throw AppException.invalidState('验收单已签署，不可重新上传');
    }
    if (!input.attachmentIds.length) {
      throw AppException.validation('请上传验收单文件');
    }
    const fileId = input.attachmentIds[0];

    await this.storage.bind([fileId], 'ORDER', id, 'ACCEPTANCE_FILE', {
      type: 'SUPPLIER',
      id: user.id,
    });

    if (order.acceptance) {
      await this.prisma.acceptanceCertificate.update({
        where: { id: order.acceptance.id },
        data: {
          supplierFileId: fileId,
          status: 'UPLOADED',
          uploadedAt: new Date(),
          uploadedBySupplierUserId: user.id,
        },
      });
    } else {
      await this.prisma.acceptanceCertificate.create({
        data: {
          orderId: id,
          status: 'UPLOADED',
          supplierFileId: fileId,
          uploadedBySupplierUserId: user.id,
        },
      });
    }

    await this.audit.record({
      action: 'acceptance.uploaded',
      targetType: 'order',
      targetId: id,
      summary: `供应商上传验收单（订单 ${order.orderNo}）`,
      actor: user,
      request,
    });

    await this.mailInternalContract(id, 'acceptance.uploaded', [fileId]).catch(
      (error: unknown) => this.logMailError('验收单上传', error),
    );
  }

  async supplierSubmitInvoice(
    id: string,
    input: {
      invoiceNo: string;
      amount: number;
      currency?: string;
      note?: string | null;
      invoiceFileIds?: string[];
      paymentRequestFileIds?: string[];
    },
    user: SupplierAuthUser,
    request?: Request,
  ): Promise<void> {
    const order = await this.getOrderOrThrow(id);
    if (order.supplierId !== user.supplierId) {
      throw AppException.notFound('订单不存在');
    }
    if (order.status === 'CANCELLED') {
      throw AppException.invalidState('订单已取消，无法提交发票');
    }
    if (order.status === 'COMPLETED') {
      throw AppException.invalidState('订单已完成，无法提交发票');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        orderId: id,
        supplierId: user.supplierId,
        invoiceNo: input.invoiceNo,
        amount: input.amount,
        currency: input.currency ?? 'CNY',
        note: input.note ?? null,
        submittedBySupplierUserId: user.id,
      },
    });

    const invoiceFiles = input.invoiceFileIds ?? [];
    const paymentFiles = input.paymentRequestFileIds ?? [];
    if (invoiceFiles.length) {
      await this.storage.bind(invoiceFiles, 'INVOICE', invoice.id, 'INVOICE_FILE', {
        type: 'SUPPLIER',
        id: user.id,
      });
    }
    if (paymentFiles.length) {
      await this.storage.bind(
        paymentFiles,
        'INVOICE',
        invoice.id,
        'PAYMENT_REQUEST',
        { type: 'SUPPLIER', id: user.id },
      );
    }

    await this.audit.record({
      action: 'invoice.submitted',
      targetType: 'order',
      targetId: id,
      summary: `提交发票 ${input.invoiceNo}（订单 ${order.orderNo}）`,
      actor: user,
      request,
      afterData: { invoiceId: invoice.id, amount: input.amount },
    });

    await this.mailInternalContract(id, 'invoice.submitted', [
      ...invoiceFiles,
      ...paymentFiles,
    ], invoice).catch((error: unknown) => this.logMailError('发票提交', error));
  }

  private async internalRecipients(project: {
    contactEmail: string;
    createdByUserId: string;
  }): Promise<string[]> {
    const creator = await this.prisma.internalUser.findUnique({
      where: { id: project.createdByUserId },
      select: { email: true },
    });
    return [...new Set([project.contactEmail, creator?.email ?? ''].filter(Boolean))];
  }

  private async supplierRecipients(supplierId: string): Promise<string[]> {
    const users = await this.prisma.supplierUser.findMany({
      where: { supplierId, isActive: true, deletedAt: null },
      select: { email: true },
    });
    return users.map((row) => row.email);
  }

  private mailAttachments(ids: string[]) {
    return this.prisma.attachment.findMany({ where: { id: { in: ids } } }).then(
      (files) =>
        files.map((file) => ({
          filename: file.fileName,
          path: this.storage.absolutePath(file.storageKey),
          contentType: file.mimeType,
        })),
    );
  }

  private async mailInternalContract(
    orderId: string,
    templateKey: 'contract.submitted' | 'acceptance.uploaded' | 'invoice.submitted',
    attachmentIds: string[],
    invoice?: { invoiceNo: string; amount: unknown; currency: string; note: string | null },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: INTERNAL_RECIPIENTS_QUERY,
    });
    if (!order) return;
    const recipients = await this.internalRecipients(order.project);
    if (!recipients.length) return;
    const platform = await this.settings.getPlatformInfo();
    const attachments = await this.mailAttachments(attachmentIds);
    const common = {
      orderNo: order.orderNo,
      supplierName: order.supplier.name,
      orderUrl: `${platform.url}/orders/${order.id}`,
      contactName: order.project.contactName,
      contactPhone: order.project.contactPhone ?? undefined,
      contactEmail: order.project.contactEmail,
    };

    const rendered =
      templateKey === 'contract.submitted'
        ? renderContractSubmitted(
            { appName: platform.name, appUrl: platform.url },
            { ...common, note: null },
          )
        : templateKey === 'acceptance.uploaded'
          ? renderAcceptanceUploaded(
              { appName: platform.name, appUrl: platform.url },
              common,
            )
          : renderInvoiceSubmitted(
              { appName: platform.name, appUrl: platform.url },
              {
                ...common,
                invoiceNo: invoice?.invoiceNo ?? '-',
                amount: invoice ? Number(invoice.amount).toFixed(2) : '-',
                currency: invoice?.currency ?? 'CNY',
                note: invoice?.note ?? null,
              },
            );

    await this.mail.send({
      templateKey,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: 'order',
      relatedId: order.id,
      attachments,
    });
  }

  private async mailSupplierContract(
    orderId: string,
    templateKey: 'contract.returned' | 'acceptance.signed',
    attachmentIds: string[],
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: INTERNAL_RECIPIENTS_QUERY,
    });
    if (!order) return;
    const recipients = await this.supplierRecipients(order.supplierId);
    if (!recipients.length) return;
    const platform = await this.settings.getPlatformInfo();
    const attachments = await this.mailAttachments(attachmentIds);
    const common = {
      orderNo: order.orderNo,
      supplierName: order.supplier.name,
      orderUrl: `${platform.url}/supplier/orders/${order.id}`,
      contactName: order.project.contactName,
      contactPhone: order.project.contactPhone ?? undefined,
      contactEmail: order.project.contactEmail,
    };
    const rendered =
      templateKey === 'contract.returned'
        ? renderContractReturned(
            { appName: platform.name, appUrl: platform.url },
            common,
          )
        : renderAcceptanceSigned(
            { appName: platform.name, appUrl: platform.url },
            { ...common, orderNo: order.orderNo },
          );

    await this.mail.send({
      templateKey,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: 'order',
      relatedId: order.id,
      attachments,
    });
  }

  private logMailError(context: string, error: unknown) {
    this.logger.error(
      `${context}邮件发送失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
