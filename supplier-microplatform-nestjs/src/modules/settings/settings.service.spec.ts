import { describe, expect, it, vi } from 'vitest';
import { SettingsService, SettingKey } from './settings.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { Env } from '../../config/env.js';

const env = { APP_URL: 'http://localhost:3000' } as Env;

function service(rows: Array<{ key: string; value: string }> = []) {
  const prisma = {
    systemSetting: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const row = rows.find((item) => item.key === where.key);
        return row ?? null;
      }),
      upsert: vi.fn(async () => ({})),
    },
  };
  return {
    settings: new SettingsService(env, prisma as unknown as PrismaService),
    prisma,
  };
}

describe('SettingsService', () => {
  it('无配置时返回默认值', async () => {
    const { settings } = service();
    await expect(settings.getAll()).resolves.toEqual({
      [SettingKey.platformName]: '供应商微平台',
      [SettingKey.platformUrl]: 'http://localhost:3000',
      [SettingKey.contactName]: '',
      [SettingKey.contactPhone]: '',
      [SettingKey.contactEmail]: '',
    });
  });

  it('数据库配置覆盖默认值', async () => {
    const { settings } = service([
      { key: SettingKey.platformName, value: '采购平台' },
      { key: SettingKey.contactEmail, value: 'buyer@local.test' },
    ]);
    await expect(settings.getPlatformInfo()).resolves.toMatchObject({
      name: '采购平台',
      url: 'http://localhost:3000',
      contactEmail: 'buyer@local.test',
    });
  });

  it('get 找不到时返回 fallback', async () => {
    const { settings } = service();
    await expect(settings.get('missing', 'default')).resolves.toBe('default');
  });

  it('setMany 逐项 upsert', async () => {
    const { settings, prisma } = service();
    await settings.setMany({ 'platform.name': '新平台', 'platform.url': 'http://x' });
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'platform.name' },
      create: { key: 'platform.name', value: '新平台' },
      update: { value: '新平台' },
    });
  });
});
