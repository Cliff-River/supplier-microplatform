import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from './common/decorators/current-user.decorator.js';
import { SupplierAuthGuard } from './common/guards/supplier-auth.guard.js';
import { AppException } from './common/errors/app.exception.js';
import type { SupplierAuthUser } from './common/types/auth-user.js';
import { PrismaService } from './prisma/prisma.service.js';

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  title: z.string().trim().max(50).nullable().optional(),
});

@Controller('supplier/me')
@UseGuards(SupplierAuthGuard)
export class SupplierMeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getMe(@CurrentUser() user: SupplierAuthUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: user.supplierId },
      select: { id: true, code: true, name: true, shortName: true, status: true },
    });
    if (!supplier) {
      throw AppException.notFound('供应商不存在');
    }
    return { user, supplier };
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: SupplierAuthUser,
    @Body({ schema: updateProfileSchema })
    body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.prisma.supplierUser.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        title: true,
      },
    });
  }
}
