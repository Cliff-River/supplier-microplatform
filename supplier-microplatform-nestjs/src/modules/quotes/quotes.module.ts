import { Module } from '@nestjs/common';
import {
  InquiryQuotesController,
  QuotesController,
  SupplierQuotesController,
} from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  controllers: [
    InquiryQuotesController,
    QuotesController,
    SupplierQuotesController,
  ],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
