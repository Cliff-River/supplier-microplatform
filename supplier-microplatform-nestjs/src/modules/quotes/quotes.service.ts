import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Request } from 'express';
import { AuditService } from '../../common/audit/audit.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import type { SupplierAuthUser } from '../../common/types/auth-user.js';
import { formatShanghaiDateTime } from '../../common/utils/codes.js';
import { MailService } from '../../mail/mail.service.js';
import { renderQuoteSubmitted } from '../../mail/mail-templates.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from '../../storage/storage.service.js';

export interface SubmitQuoteInput {
  unitPrice: number;
  totalPrice?: number;
  currency?: string;
  deliveryDays?: number | null;
  validUntil?: Date | null;
  note?: string | null;
  attachmentIds?: string[];
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  async listForInquiry(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });
    if (!inquiry) {
      throw AppException.notFound('询价项不存在');
    }
    const quotes = await this.prisma.quote.findMany({
      where: { inquiryId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
      orderBy: { totalPrice: 'asc' },
    });
    const quoteIds = quotes.map((row) => row.id);
    const attachments = quoteIds.length
      ? await this.prisma.attachment.findMany({
          where: { scope: 'QUOTE', scopeId: { in: quoteIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const map = new Map<string, typeof attachments>();
    for (const file of attachments) {
      const key = file.scopeId ?? '';
      const list = map.get(key) ?? [];
      list.push(file);
      map.set(key, list);
    }

    const minTotal = quotes.length
      ? Math.min(...quotes.map((row) => Number(row.totalPrice)))
      : null;
    const minDelivery = quotes.length
      ? Math.min(
          ...quotes
            .map((row) => row.deliveryDays)
            .filter((value): value is number => value != null),
        )
      : null;

    return {
      items: quotes.map((quote) => ({
        ...quote,
        attachments: map.get(quote.id) ?? [],
        isLowestTotal:
          minTotal !== null && Number(quote.totalPrice) === minTotal,
        isFastest:
          minDelivery !== null &&
          Number.isFinite(minDelivery) &&
          quote.deliveryDays === minDelivery,
      })),
    };
  }

  async detail(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, code: true, ratingAvg: true } },
        inquiry: {
          include: {
            project: {
              select: { id: true, name: true, code: true, createdByUserId: true },
            },
          },
        },
      },
    });
    if (!quote) {
      throw AppException.notFound('报价不存在');
    }
    const attachments = await this.prisma.attachment.findMany({
      where: { scope: 'QUOTE', scopeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { ...quote, attachments };
  }

  async exportInquiryQuotes(inquiryId: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { project: { select: { name: true, code: true } } },
    });
    if (!inquiry) {
      throw AppException.notFound('询价项不存在');
    }
    const { items } = await this.listForInquiry(inquiryId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('报价对比');
    sheet.columns = [
      { header: '供应商', key: 'supplier', width: 26 },
      { header: '供应商编码', key: 'supplierCode', width: 20 },
      { header: '单价', key: 'unitPrice', width: 14 },
      { header: '总价', key: 'totalPrice', width: 16 },
      { header: '币种', key: 'currency', width: 8 },
      { header: '交期（天）', key: 'deliveryDays', width: 12 },
      { header: '报价有效期', key: 'validUntil', width: 16 },
      { header: '版本', key: 'version', width: 8 },
      { header: '提交时间', key: 'submittedAt', width: 22 },
      { header: '补充说明', key: 'note', width: 40 },
    ];
    for (const quote of items) {
      sheet.addRow({
        supplier: quote.supplier.name,
        supplierCode: quote.supplier.code,
        unitPrice: Number(quote.unitPrice),
        totalPrice: Number(quote.totalPrice),
        currency: quote.currency,
        deliveryDays: quote.deliveryDays ?? '',
        validUntil: quote.validUntil ? formatShanghaiDateTime(quote.validUntil).slice(0, 10) : '',
        version: quote.version,
        submittedAt: formatShanghaiDateTime(quote.submittedAt),
        note: quote.note ?? '',
      });
    }
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    const meta = workbook.addWorksheet('询价信息');
    meta.columns = [
      { header: '字段', key: 'label', width: 18 },
      { header: '内容', key: 'value', width: 60 },
    ];
    meta.addRow({ label: '项目', value: `${inquiry.project.name}（${inquiry.project.code}）` });
    meta.addRow({ label: '询价项', value: inquiry.title });
    meta.addRow({ label: '数量', value: `${inquiry.quantity.toString()} ${inquiry.unit}` });
    meta.addRow({ label: '截止时间', value: formatShanghaiDateTime(inquiry.deadline) });
    meta.getRow(1).font = { bold: true };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      fileName: `报价对比-${inquiry.code}.xlsx`,
    };
  }

  async submitQuote(
    inquiryId: string,
    user: SupplierAuthUser,
    input: SubmitQuoteInput,
    request?: Request,
  ) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { project: true },
    });
    if (!inquiry) {
      throw AppException.notFound('询价项不存在');
    }
    if (inquiry.status !== 'OPEN') {
      throw AppException.invalidState('询价已关闭，无法提交报价');
    }
    if (inquiry.deadline.getTime() <= Date.now()) {
      throw AppException.invalidState('已超过报价截止时间');
    }
    const invite = await this.prisma.inquirySupplier.findUnique({
      where: {
        inquiryId_supplierId: {
          inquiryId,
          supplierId: user.supplierId,
        },
      },
    });
    if (!invite) {
      throw AppException.forbidden('您未被邀请参与该询价');
    }

    const quantity = Number(inquiry.quantity);
    const totalPrice =
      input.totalPrice ?? Number((input.unitPrice * quantity).toFixed(2));

    const existing = await this.prisma.quote.findUnique({
      where: {
        inquiryId_supplierId: { inquiryId, supplierId: user.supplierId },
      },
    });

    const quote = existing
      ? await this.prisma.quote.update({
          where: { id: existing.id },
          data: {
            unitPrice: input.unitPrice,
            totalPrice,
            currency: input.currency ?? existing.currency,
            deliveryDays: input.deliveryDays ?? null,
            validUntil: input.validUntil ?? null,
            note: input.note ?? null,
            version: existing.version + 1,
            submittedAt: new Date(),
          },
        })
      : await this.prisma.quote.create({
          data: {
            inquiryId,
            supplierId: user.supplierId,
            unitPrice: input.unitPrice,
            totalPrice,
            currency: input.currency ?? 'CNY',
            deliveryDays: input.deliveryDays ?? null,
            validUntil: input.validUntil ?? null,
            note: input.note ?? null,
            version: 1,
          },
        });

    if (input.attachmentIds?.length) {
      await this.storage.bind(input.attachmentIds, 'QUOTE', quote.id, 'QUOTE_FILE', {
        type: 'SUPPLIER',
        id: user.id,
      });
    }

    await this.audit.record({
      action: 'quote.submitted',
      targetType: 'quote',
      targetId: quote.id,
      summary: `提交报价（询价 ${inquiry.title}，第 ${quote.version} 版）`,
      actor: user,
      request,
      afterData: {
        inquiryId,
        unitPrice: quote.unitPrice.toString(),
        totalPrice: quote.totalPrice.toString(),
        version: quote.version,
      },
    });

    await this.sendQuoteMail(inquiry.id, quote.id).catch((error: unknown) => {
      this.logger.error(
        `报价邮件发送失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return this.detail(quote.id);
  }

  private async sendQuoteMail(inquiryId: string, quoteId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { project: true },
    });
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { supplier: { select: { name: true } } },
    });
    if (!inquiry || !quote) return;

    const creator = await this.prisma.internalUser.findUnique({
      where: { id: inquiry.project.createdByUserId },
      select: { email: true },
    });
    const recipients = [inquiry.project.contactEmail, creator?.email ?? ''].filter(
      Boolean,
    );
    if (recipients.length === 0) return;

    const [platform, attachments] = await Promise.all([
      this.settings.getPlatformInfo(),
      this.prisma.attachment.findMany({
        where: { scope: 'QUOTE', scopeId: quoteId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rendered = renderQuoteSubmitted(
      { appName: platform.name, appUrl: platform.url },
      {
        projectName: inquiry.project.name,
        inquiryTitle: inquiry.title,
        supplierName: quote.supplier.name,
        unitPrice: Number(quote.unitPrice).toFixed(2),
        totalPrice: Number(quote.totalPrice).toFixed(2),
        currency: quote.currency,
        deliveryDays: quote.deliveryDays,
        validUntil: quote.validUntil
          ? formatShanghaiDateTime(quote.validUntil).slice(0, 10)
          : null,
        note: quote.note,
        version: quote.version,
        quoteUrl: `${platform.url}/projects/${inquiry.projectId}/inquiries/${inquiry.id}`,
        contactName: inquiry.project.contactName,
        contactPhone: inquiry.project.contactPhone ?? undefined,
        contactEmail: inquiry.project.contactEmail,
      },
    );

    await this.mail.send({
      templateKey: 'quote.submitted',
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: 'quote',
      relatedId: quoteId,
      attachments: attachments.map((file) => ({
        filename: file.fileName,
        path: this.storage.absolutePath(file.storageKey),
        contentType: file.mimeType,
      })),
    });
  }
}
