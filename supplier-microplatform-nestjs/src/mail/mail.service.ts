import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service.js';
import { ENV, type Env } from '../config/env.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import { renderAccountCreated, renderPasswordReset } from './mail-templates.js';

export interface MailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  templateKey: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
  relatedType?: string;
  relatedId?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of emails) {
    const trimmed = email?.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      auth: env.MAIL_USER
        ? { user: env.MAIL_USER, pass: env.MAIL_PASS }
        : undefined,
    });
  }

  get from(): string {
    return this.env.MAIL_FROM;
  }

  async sendAccountCreated(
    kind: 'INTERNAL' | 'SUPPLIER',
    to: string[],
    data: { name: string; username: string; password: string },
  ): Promise<{ status: 'SENT' | 'FAILED' | 'SKIPPED' }> {
    const platform = await this.settings.getPlatformInfo();
    const loginUrl =
      kind === 'INTERNAL'
        ? `${platform.url}/login`
        : `${platform.url}/supplier/login`;
    const rendered = renderAccountCreated(
      { appName: platform.name, appUrl: platform.url },
      { ...data, loginUrl, isSupplier: kind === 'SUPPLIER' },
    );
    const log = await this.send({
      templateKey: 'account.created',
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: kind === 'INTERNAL' ? 'internal_user' : 'supplier_user',
    });
    return { status: log?.status ?? 'SKIPPED' };
  }

  async sendPasswordReset(
    kind: 'INTERNAL' | 'SUPPLIER',
    to: string[],
    data: { name: string; token: string },
  ): Promise<void> {
    const platform = await this.settings.getPlatformInfo();
    const resetUrlBase =
      kind === 'INTERNAL'
        ? `${platform.url}/reset-password`
        : `${platform.url}/supplier/reset-password`;
    const rendered = renderPasswordReset(
      { appName: platform.name, appUrl: platform.url },
      { name: data.name, resetUrl: `${resetUrlBase}?token=${encodeURIComponent(data.token)}` },
    );
    await this.send({
      templateKey: 'account.reset-password',
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      relatedType: kind === 'INTERNAL' ? 'internal_user' : 'supplier_user',
    });
  }

  async send(
    input: SendMailInput,
  ): Promise<{ id: string; status: 'SENT' | 'FAILED' | 'SKIPPED' } | null> {
    const to = normalizeEmails(input.to);
    const cc = normalizeEmails(input.cc ?? []);
    if (to.length === 0) {
      this.logger.warn(`跳过邮件 ${input.templateKey}：没有有效收件人`);
      return null;
    }

    const log = await this.prisma.mailLog.create({
      data: {
        templateKey: input.templateKey,
        toEmails: to.join(','),
        ccEmails: cc.length ? cc.join(',') : null,
        subject: input.subject,
        status: 'PENDING',
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        payload: {
          html: input.html,
          text: input.text,
          attachments: input.attachments ?? [],
        } as never,
      },
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        cc: cc.length ? cc : undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      });
      await this.prisma.mailLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          attempts: { increment: 1 },
          sentAt: new Date(),
          error: null,
        },
      });
      return { id: log.id, status: 'SENT' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`邮件发送失败 ${input.templateKey}: ${message}`);
      await this.prisma.mailLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          error: message.slice(0, 1000),
        },
      });
      return { id: log.id, status: 'FAILED' };
    }
  }

  async retry(logId: string): Promise<{ status: 'SENT' | 'FAILED' }> {
    const log = await this.prisma.mailLog.findUnique({ where: { id: logId } });
    if (!log) {
      throw new Error('邮件日志不存在');
    }
    const payload = (log.payload ?? {}) as {
      html?: string;
      text?: string;
      attachments?: MailAttachment[];
    };
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: log.toEmails.split(','),
        cc: log.ccEmails ? log.ccEmails.split(',') : undefined,
        subject: log.subject,
        html: payload.html,
        text: payload.text,
        attachments: payload.attachments,
      });
      await this.prisma.mailLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          attempts: { increment: 1 },
          sentAt: new Date(),
          error: null,
        },
      });
      return { status: 'SENT' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.mailLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          error: message.slice(0, 1000),
        },
      });
      return { status: 'FAILED' };
    }
  }
}
