import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { InternalAuthUser } from '../../common/types/auth-user.js';
import {
  paginationMeta,
  parsePagination,
} from '../../common/utils/pagination.js';
import { ENV, type Env } from '../../config/env.js';
import { MailService } from '../../mail/mail.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingKey, SettingsService } from '../settings/settings.service.js';

const auditQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  actorType: z.enum(['INTERNAL', 'SUPPLIER', 'SYSTEM']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const mailLogQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  templateKey: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const settingsSchema = z.object({
  platformName: z.string().trim().min(1, '平台名称不能为空').max(50).optional(),
  platformUrl: z.url('平台地址格式不正确').optional(),
  contactName: z.string().trim().max(50).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.union([z.email('联系人邮箱格式不正确'), z.literal('')]).optional(),
});

const mailTestSchema = z.object({
  to: z.email('收件人邮箱格式不正确'),
});

@Controller('admin')
@UseGuards(InternalAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('audit-logs')
  async auditLogs(
    @Query({ schema: auditQuerySchema })
    query: z.infer<typeof auditQuerySchema>,
  ) {
    const pagination = parsePagination(query);
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (from && !Number.isNaN(from.getTime())) createdAtFilter.gte = from;
    if (to && !Number.isNaN(to.getTime())) createdAtFilter.lte = to;
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorType ? { actorType: query.actorType } : {}),
      ...(Object.keys(createdAtFilter).length > 0
        ? { createdAt: createdAtFilter }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                summary: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
              {
                actorName: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
              {
                targetId: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return { data: items, meta: paginationMeta(total, pagination) };
  }

  @Get('mail-logs')
  async mailLogs(
    @Query({ schema: mailLogQuerySchema })
    query: z.infer<typeof mailLogQuerySchema>,
  ) {
    const pagination = parsePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.templateKey ? { templateKey: query.templateKey } : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                toEmails: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
              {
                subject: {
                  contains: query.keyword,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.mailLog.count({ where }),
      this.prisma.mailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          templateKey: true,
          toEmails: true,
          ccEmails: true,
          subject: true,
          status: true,
          attempts: true,
          error: true,
          relatedType: true,
          relatedId: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    ]);

    return { data: items, meta: paginationMeta(total, pagination) };
  }

  @Post('mail-logs/:id/retry')
  async retryMail(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const log = await this.prisma.mailLog.findUnique({ where: { id } });
    if (!log) {
      throw AppException.notFound('邮件日志不存在');
    }
    const result = await this.mail.retry(id);
    await this.audit.record({
      action: 'mail.retried',
      targetType: 'mail_log',
      targetId: id,
      summary: `重发邮件 ${log.templateKey}`,
      actor: user,
      request,
      afterData: { status: result.status },
    });
    return { id, status: result.status };
  }

  @Get('settings')
  async getSettings() {
    const platform = await this.settings.getPlatformInfo();
    return {
      platform,
      mail: {
        host: this.env.MAIL_HOST,
        port: this.env.MAIL_PORT,
        secure: this.env.MAIL_SECURE,
        from: this.env.MAIL_FROM,
        hasAuth: Boolean(this.env.MAIL_USER),
      },
    };
  }

  @Put('settings')
  async updateSettings(
    @Body({ schema: settingsSchema })
    body: z.infer<typeof settingsSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const entries: Record<string, string> = {};
    if (body.platformName !== undefined) {
      entries[SettingKey.platformName] = body.platformName;
    }
    if (body.platformUrl !== undefined) {
      entries[SettingKey.platformUrl] = body.platformUrl.replace(/\/$/, '');
    }
    if (body.contactName !== undefined) {
      entries[SettingKey.contactName] = body.contactName;
    }
    if (body.contactPhone !== undefined) {
      entries[SettingKey.contactPhone] = body.contactPhone;
    }
    if (body.contactEmail !== undefined) {
      entries[SettingKey.contactEmail] = body.contactEmail;
    }

    if (Object.keys(entries).length > 0) {
      await this.settings.setMany(entries);
      await this.audit.record({
        action: 'settings.updated',
        targetType: 'system_setting',
        targetId: 'platform',
        summary: '更新平台系统设置',
        actor: user,
        request,
        afterData: entries,
      });
    }

    return this.getSettings();
  }

  @Post('mail/test')
  async sendTestMail(
    @Body({ schema: mailTestSchema }) body: z.infer<typeof mailTestSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const platform = await this.settings.getPlatformInfo();
    const subject = `【测试】${platform.name} 邮件配置验证`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.7"><h2>${platform.name} 邮件测试</h2><p>这是一封来自系统设置的测试邮件，收到说明 SMTP 配置可用。</p><p>发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p></div>`;
    const text = `${platform.name} 邮件测试：SMTP 配置可用。`;

    const log = await this.mail.send({
      templateKey: 'mail.test',
      to: [body.to],
      subject,
      html,
      text,
      relatedType: 'system_setting',
    });

    if (!log) {
      throw AppException.validation('收件人邮箱无效');
    }

    await this.audit.record({
      action: 'mail.test_sent',
      targetType: 'mail_log',
      targetId: log.id,
      summary: `向 ${body.to} 发送测试邮件`,
      actor: user,
      request,
      afterData: { status: log.status },
    });

    return { id: log.id, status: log.status };
  }
}
