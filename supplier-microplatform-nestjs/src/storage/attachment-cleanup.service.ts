import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

const TEMP_ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;
const AUDIT_LOG_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

@Injectable()
export class AttachmentCleanupService {
  private readonly logger = new Logger(AttachmentCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** 每天清理超过 24 小时未绑定业务的临时附件。 */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupTempAttachments(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TEMP_ATTACHMENT_TTL_MS);
    try {
      const attachments = await this.prisma.attachment.findMany({
        where: {
          scope: 'TEMP',
          OR: [{ createdAt: { lt: cutoff } }, { expiresAt: { lt: now } }],
        },
        select: { id: true },
      });
      for (const attachment of attachments) {
        await this.storage.remove(attachment.id);
      }
      if (attachments.length > 0) {
        this.logger.log(`已清理 ${attachments.length} 个过期临时附件`);
      }
      return attachments.length;
    } catch (error) {
      this.logger.error(
        `清理临时附件失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    }
  }

  /** 审计日志保留 180 天，到期后删除。 */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupAuditLogs(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - AUDIT_LOG_RETENTION_MS);
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`已清理 ${result.count} 条过期审计日志`);
      }
      return result.count;
    } catch (error) {
      this.logger.error(
        `清理审计日志失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    }
  }
}
