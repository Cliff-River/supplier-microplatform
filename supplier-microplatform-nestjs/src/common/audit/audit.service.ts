import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../types/auth-user.js';

export interface AuditInput {
  action: string;
  targetType: string;
  targetId: string;
  summary?: string;
  beforeData?: unknown;
  afterData?: unknown;
  actor?: AuthUser | { kind: 'SYSTEM'; name?: string };
  request?: Request;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    const actor = input.actor;
    const ip = input.request?.ip;
    const userAgent = input.request?.headers?.['user-agent'];
    await this.prisma.auditLog.create({
      data: {
        actorType: actor
          ? actor.kind === 'INTERNAL'
            ? 'INTERNAL'
            : actor.kind === 'SUPPLIER'
              ? 'SUPPLIER'
              : 'SYSTEM'
          : 'SYSTEM',
        actorId: actor && 'id' in actor ? actor.id : null,
        actorName: actor?.name ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary ?? null,
        beforeData: (input.beforeData ?? null) as never,
        afterData: (input.afterData ?? null) as never,
        ip: typeof ip === 'string' ? ip : null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
      },
    });
  }
}
