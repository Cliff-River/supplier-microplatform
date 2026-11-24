import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { OrdersService } from './orders.service.js';

const listQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  status: z
    .enum(['PENDING_CONTRACT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .optional(),
  projectId: z.string().optional(),
  supplierId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});

const contractReturnSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
  attachmentIds: z.array(z.string()).min(1, '请上传修订版合同'),
});

const contractSubmitSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
  attachmentIds: z.array(z.string()).min(1, '请上传合同文件'),
});

const signAcceptanceSchema = z.object({
  signedFileId: z.string().nullable().optional(),
});

const acceptanceUploadSchema = z.object({
  attachmentIds: z.array(z.string()).min(1, '请上传验收单文件'),
});

const invoiceSchema = z.object({
  invoiceNo: z.string().trim().min(1, '请填写发票号').max(100),
  amount: z.coerce.number().min(0, '发票金额不能为负数'),
  currency: z.string().trim().length(3).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  invoiceFileIds: z.array(z.string()).default([]),
  paymentRequestFileIds: z.array(z.string()).default([]),
});

@Controller('orders')
@UseGuards(InternalAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(
    @Query({ schema: listQuerySchema })
    query: z.infer<typeof listQuerySchema>,
  ) {
    return this.orders.list(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Get(':id/invoices')
  async invoices(@Param('id') id: string) {
    const detail = await this.orders.detail(id);
    return { items: detail.invoices };
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.complete(id, user, request);
    return this.orders.detail(id);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body({ schema: cancelSchema }) body: z.infer<typeof cancelSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.cancel(id, body.reason, user, request);
    return this.orders.detail(id);
  }

  @Post(':id/contract/return')
  async returnContract(
    @Param('id') id: string,
    @Body({ schema: contractReturnSchema })
    body: z.infer<typeof contractReturnSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.returnContract(id, body, user, request);
    return this.orders.detail(id);
  }

  @Post(':id/contract/complete')
  async completeContract(
    @Param('id') id: string,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.completeContract(id, user, request);
    return this.orders.detail(id);
  }

  @Post(':id/acceptance/sign')
  async signAcceptance(
    @Param('id') id: string,
    @Body({ schema: signAcceptanceSchema })
    body: z.infer<typeof signAcceptanceSchema>,
    @CurrentUser() user: InternalAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.signAcceptance(id, body, user, request);
    return this.orders.detail(id);
  }
}

@Controller('supplier/orders')
@UseGuards(SupplierAuthGuard)
export class SupplierOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(@CurrentUser() user: SupplierAuthUser) {
    const items = await this.orders.supplierList(user);
    return { items, meta: { total: items.length } };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: SupplierAuthUser) {
    return this.orders.supplierDetail(id, user);
  }

  @Post(':id/contract')
  async submitContract(
    @Param('id') id: string,
    @Body({ schema: contractSubmitSchema })
    body: z.infer<typeof contractSubmitSchema>,
    @CurrentUser() user: SupplierAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.supplierSubmitContract(id, body, user, request);
    return this.orders.supplierDetail(id, user);
  }

  @Post(':id/acceptance')
  async uploadAcceptance(
    @Param('id') id: string,
    @Body({ schema: acceptanceUploadSchema })
    body: z.infer<typeof acceptanceUploadSchema>,
    @CurrentUser() user: SupplierAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.supplierUploadAcceptance(id, body, user, request);
    return this.orders.supplierDetail(id, user);
  }

  @Post(':id/invoices')
  async submitInvoice(
    @Param('id') id: string,
    @Body({ schema: invoiceSchema }) body: z.infer<typeof invoiceSchema>,
    @CurrentUser() user: SupplierAuthUser,
    @Req() request: Request,
  ) {
    await this.orders.supplierSubmitInvoice(id, body, user, request);
    return this.orders.supplierDetail(id, user);
  }
}
