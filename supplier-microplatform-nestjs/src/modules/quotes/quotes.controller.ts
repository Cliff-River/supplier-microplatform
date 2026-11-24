import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { SupplierAuthGuard } from '../../common/guards/supplier-auth.guard.js';
import type { SupplierAuthUser } from '../../common/types/auth-user.js';
import { QuotesService } from './quotes.service.js';

const submitQuoteSchema = z.object({
  unitPrice: z.coerce.number().min(0, '单价不能为负数'),
  totalPrice: z.coerce.number().min(0, '总价不能为负数').optional(),
  currency: z.string().trim().length(3).optional(),
  deliveryDays: z.coerce.number().int().min(0).nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  attachmentIds: z.array(z.string()).default([]),
});

@Controller('inquiries')
@UseGuards(InternalAuthGuard)
export class InquiryQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get(':id/quotes')
  async list(@Param('id') id: string) {
    return this.quotes.listForInquiry(id);
  }

  @Get(':id/quotes/export')
  async export(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.quotes.exportInquiryQuotes(id);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    return new StreamableFile(buffer);
  }
}

@Controller('quotes')
@UseGuards(InternalAuthGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.quotes.detail(id);
  }
}

@Controller('supplier/inquiries')
@UseGuards(SupplierAuthGuard)
export class SupplierQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Put(':id/quote')
  async submit(
    @Param('id') id: string,
    @Body({ schema: submitQuoteSchema })
    body: z.infer<typeof submitQuoteSchema>,
    @CurrentUser() user: SupplierAuthUser,
    @Req() request: Request,
  ) {
    return this.quotes.submitQuote(id, user, body, request);
  }
}
