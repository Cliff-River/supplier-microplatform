import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from './common/decorators/current-user.decorator.js';
import { InternalAuthGuard } from './common/guards/internal-auth.guard.js';
import type { InternalAuthUser } from './common/types/auth-user.js';
import { PrismaService } from './prisma/prisma.service.js';

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

@Controller('me')
@UseGuards(InternalAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getMe(@CurrentUser() user: InternalAuthUser) {
    return user;
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: InternalAuthUser,
    @Body({ schema: updateProfileSchema })
    body: z.infer<typeof updateProfileSchema>,
  ) {
    const updated = await this.prisma.internalUser.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
      },
      select: { id: true, name: true, email: true, username: true, phone: true },
    });
    return updated;
  }
}
