import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InquiriesService } from './inquiries.service.js';

@Injectable()
export class InquirySchedulerService {
  private readonly logger = new Logger(InquirySchedulerService.name);

  constructor(private readonly inquiries: InquiriesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredInquiries(): Promise<void> {
    try {
      const count = await this.inquiries.closeExpired();
      if (count > 0) {
        this.logger.log(`已自动关闭 ${count} 个到期询价项`);
      }
    } catch (error) {
      this.logger.error(
        `自动关闭到期询价失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
