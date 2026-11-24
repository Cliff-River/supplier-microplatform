import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const SettingKey = {
  platformName: 'platform.name',
  platformUrl: 'platform.url',
  contactName: 'platform.contactName',
  contactPhone: 'platform.contactPhone',
  contactEmail: 'platform.contactEmail',
} as const;

export interface PlatformInfo {
  name: string;
  url: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  private defaults(): Record<string, string> {
    return {
      [SettingKey.platformName]: '供应商微平台',
      [SettingKey.platformUrl]: this.env.APP_URL,
      [SettingKey.contactName]: '',
      [SettingKey.contactPhone]: '',
      [SettingKey.contactEmail]: '',
    };
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    const result = this.defaults();
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async getPlatformInfo(): Promise<PlatformInfo> {
    const all = await this.getAll();
    return {
      name: all[SettingKey.platformName],
      url: all[SettingKey.platformUrl],
      contactName: all[SettingKey.contactName],
      contactPhone: all[SettingKey.contactPhone],
      contactEmail: all[SettingKey.contactEmail],
    };
  }

  async get(key: string, fallback = ''): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  }
}
