import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function service() {
  const create = vi.fn(async () => ({}));
  const prisma = { auditLog: { create } };
  return {
    audit: new AuditService(prisma as unknown as PrismaService),
    create,
  };
}

describe('AuditService.record', () => {
  it('记录内部操作人与请求上下文', async () => {
    const { audit, create } = service();
    await audit.record({
      action: 'project.created',
      targetType: 'project',
      targetId: 'p1',
      summary: '创建项目',
      beforeData: undefined,
      afterData: { name: '项目' },
      actor: { kind: 'INTERNAL', id: 'u1', name: '管理员' },
      request: {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest' },
      } as never,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'INTERNAL',
        actorId: 'u1',
        actorName: '管理员',
        action: 'project.created',
        targetType: 'project',
        targetId: 'p1',
        summary: '创建项目',
        beforeData: null,
        afterData: { name: '项目' },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      }),
    });
  });

  it('系统操作人没有 ID', async () => {
    const { audit, create } = service();
    await audit.record({
      action: 'inquiry.closed',
      targetType: 'inquiry',
      targetId: 'i1',
      actor: { kind: 'SYSTEM', name: '定时任务' },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'SYSTEM',
        actorId: null,
        actorName: '定时任务',
        ip: null,
        userAgent: null,
      }),
    });
  });
});
