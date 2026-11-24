import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { SupplierAuthGuard } from '../../common/guards/supplier-auth.guard.js';
import type {
  InternalAuthUser,
  SupplierAuthUser,
} from '../../common/types/auth-user.js';
import { InquiriesService } from './inquiries.service.js';

const inquiryBodySchema = z.object({
  title: z.string().trim().min(1, '询价项标题不能为空').max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.coerce.number().positive('数量必须大于 0').optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  deadline: z.coerce.date().optional(),
  invitedSupplierIds: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string()).optional(),
});

const createInquirySchema = inquiryBodySchema.extend({
  title: z.string().trim().min(1, '询价项标题不能为空').max(200),
  quantity: z.coerce.number().positive('数量必须大于 0'),
  unit: z.string().trim().min(1, '单位不能为空').max(20),
  deadline: z.coerce.date(),
  invitedSupplierIds: z.array(z.string()).default([]),
});

const reopenSchema = z.object({
  deadline: z.coerce.date(),
  resend: z.boolean().default(false),
});

const resendSchema = z.object({
  supplierIds: z.array(z.string()).optional(),
});

const awardSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
});

@Controller('inquiries')
@UseGuards(InternalAuthGuard)
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.inquiries.detail(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body({ schema: inquiryBodySchema })
    body: z.infer<typeof inquiryBodySchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.inquiries.update(id, body, user, request);
    return this.inquiries.detail(id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.inquiries.remove(id, user, request);
  }

  @Post(':id/send')
  async send(
    @Param('id') id: string,
    @Body({ schema: resendSchema }) body: z.infer<typeof resendSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.inquiries.send(id, user, request, body.supplierIds);
  }

  @Post(':id/close')
  async close(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.inquiries.close(id, user, request);
    return this.inquiries.detail(id);
  }

  @Post(':id/reopen')
  async reopen(
    @Param('id') id: string,
    @Body({ schema: reopenSchema }) body: z.infer<typeof reopenSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const result = await this.inquiries.reopen(
      id,
      body.deadline,
      body.resend,
      user,
      request,
    );
    return { ...(await this.inquiries.detail(id)), mailResult: result };
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.inquiries.cancel(id, user, request);
    return this.inquiries.detail(id);
  }

  @Post(':id/resend')
  async resend(
    @Param('id') id: string,
    @Body({ schema: resendSchema }) body: z.infer<typeof resendSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.inquiries.resend(id, body.supplierIds, user, request);
  }

  @Post(':id/award')
  async award(
    @Param('id') id: string,
    @Body({ schema: awardSchema }) body: z.infer<typeof awardSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    return this.inquiries.award(id, body.supplierId, user, request);
  }
}

@Controller('projects/:projectId/inquiries')
@UseGuards(InternalAuthGuard)
export class ProjectInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  async list(@Param('projectId') projectId: string) {
    return this.inquiries.listByProject(projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body({ schema: createInquirySchema })
    body: z.infer<typeof createInquirySchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    const created = await this.inquiries.createForProject(
      projectId,
      body,
      user,
      request,
    );
    return this.inquiries.detail(created.id);
  }
}

@Controller('supplier')
@UseGuards(SupplierAuthGuard)
export class SupplierInquiryController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get('inquiries')
  async list(@CurrentUser() user: SupplierAuthUser) {
    return this.inquiries.supplierList(user);
  }

  @Get('inquiries/:id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: SupplierAuthUser,
  ) {
    return this.inquiries.supplierDetail(id, user);
  }

  @Get('quote-history')
  async history(@CurrentUser() user: SupplierAuthUser) {
    return this.inquiries.supplierQuoteHistory(user);
  }
}
