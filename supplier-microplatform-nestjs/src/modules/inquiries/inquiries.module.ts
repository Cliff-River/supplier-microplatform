import { Module } from '@nestjs/common';
import {
  InquiriesController,
  ProjectInquiriesController,
  SupplierInquiryController,
} from './inquiries.controller.js';
import { InquiriesService } from './inquiries.service.js';
import { InquirySchedulerService } from './inquiry-scheduler.service.js';

@Module({
  controllers: [
    InquiriesController,
    ProjectInquiriesController,
    SupplierInquiryController,
  ],
  providers: [InquiriesService, InquirySchedulerService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
