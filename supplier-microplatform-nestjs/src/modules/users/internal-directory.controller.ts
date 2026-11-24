import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const querySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
});

/** 供内部用户选择「指定可见用户」等场景使用的通讯录接口 */
@Controller('internal-users')
@UseGuards(InternalAuthGuard)
export class InternalDirectoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query({ schema: querySchema }) query: z.infer<typeof querySchema>) {
    return this.prisma.internalUser.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query.keyword
          ? {
              OR: [
                {
                  name: {
                    contains: query.keyword,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  email: {
                    contains: query.keyword,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true, email: true, role: true },
    });
  }
}
