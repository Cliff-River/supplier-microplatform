import { describe, expect, it, vi } from 'vitest';
import { AttachmentCleanupService } from './attachment-cleanup.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from './storage.service.js';

function createService(options?: {
  attachments?: Array<{ id: string }>;
  auditCount?: number;
  findManyError?: Error;
  deleteManyError?: Error;
}) {
  const findMany = vi.fn(async (_args?: { where?: unknown }) => {
    if (options?.findManyError) throw options.findManyError;
    return options?.attachments ?? [];
  });
  const deleteMany = vi.fn(async () => {
    if (options?.deleteManyError) throw options.deleteManyError;
    return { count: options?.auditCount ?? 0 };
  });
  const remove = vi.fn(async (_id: string) => undefined);
  const prisma = {
    attachment: { findMany },
    auditLog: { deleteMany },
  };
  const service = new AttachmentCleanupService(
    prisma as unknown as PrismaService,
    { remove } as unknown as StorageService,
  );
  return { service, findMany, deleteMany, remove };
}

describe('AttachmentCleanupService.cleanupTempAttachments', () => {
  it('清理超过 24 小时的临时附件并删除文件', async () => {
    const now = new Date('2026-11-25T03:00:00.000Z');
    const { service, findMany, remove } = createService({
      attachments: [{ id: 'a1' }, { id: 'a2' }],
    });

    await expect(service.cleanupTempAttachments(now)).resolves.toBe(2);
    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0]?.[0]?.where as {
      scope: string;
      OR: unknown[];
    };
    expect(where.scope).toBe('TEMP');
    expect(where.OR).toEqual([
      { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      { expiresAt: { lt: now } },
    ]);
    expect(remove).toHaveBeenCalledWith('a1');
    expect(remove).toHaveBeenCalledWith('a2');
  });

  it('没有可清理附件时返回 0', async () => {
    const { service, remove } = createService({ attachments: [] });
    await expect(service.cleanupTempAttachments()).resolves.toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it('查询失败时记录日志并返回 0', async () => {
    const { service } = createService({
      findManyError: new Error('db down'),
    });
    await expect(service.cleanupTempAttachments()).resolves.toBe(0);
  });
});

describe('AttachmentCleanupService.cleanupAuditLogs', () => {
  it('删除超过 180 天的审计日志', async () => {
    const now = new Date('2026-11-25T03:00:00.000Z');
    const { service, deleteMany } = createService({ auditCount: 3 });

    await expect(service.cleanupAuditLogs(now)).resolves.toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        },
      },
    });
  });

  it('删除失败时返回 0', async () => {
    const { service } = createService({
      deleteManyError: new Error('db down'),
    });
    await expect(service.cleanupAuditLogs()).resolves.toBe(0);
  });
});
