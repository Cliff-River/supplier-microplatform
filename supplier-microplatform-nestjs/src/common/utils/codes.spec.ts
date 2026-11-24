import { describe, expect, it, vi } from 'vitest';
import {
  dailyCode,
  daysFromNow,
  formatShanghaiDateTime,
  generateDailyCode,
  shanghaiDateStamp,
} from './codes.js';

describe('shanghaiDateStamp', () => {
  it('按 Asia/Shanghai 跨日计算日期', () => {
    // UTC 17:00 已是上海次日 01:00
    expect(shanghaiDateStamp(new Date('2026-11-24T17:00:00Z'))).toBe('20261125');
    expect(shanghaiDateStamp(new Date('2026-11-24T15:59:59Z'))).toBe('20261124');
  });
});

describe('dailyCode', () => {
  it('生成四位补零的业务编号', () => {
    expect(dailyCode('PRJ', 7, new Date('2026-11-24T02:00:00Z'))).toBe(
      'PRJ-20261124-0007',
    );
    expect(dailyCode('ORD', 1234, new Date('2026-11-24T02:00:00Z'))).toBe(
      'ORD-20261124-1234',
    );
  });
});

describe('generateDailyCode', () => {
  it('跳过已存在的编号', async () => {
    const taken = new Set(['INQ-20261124-0001', 'INQ-20261124-0002']);
    const exists = vi.fn(async (code: string) => taken.has(code));

    await expect(
      generateDailyCode('INQ', exists, new Date('2026-11-24T02:00:00Z')),
    ).resolves.toBe('INQ-20261124-0003');
    expect(exists).toHaveBeenCalledTimes(3);
  });
});

describe('formatShanghaiDateTime', () => {
  it('空值返回占位符', () => {
    expect(formatShanghaiDateTime(null)).toBe('-');
    expect(formatShanghaiDateTime(undefined)).toBe('-');
  });

  it('按上海时区展示日期时间', () => {
    const text = formatShanghaiDateTime(new Date('2026-11-24T13:05:00Z'));
    expect(text).toContain('2026');
    expect(text).toContain('11');
    expect(text).toContain('24');
    expect(text).toContain('21:05');
  });
});

describe('daysFromNow', () => {
  it('按天数偏移', () => {
    const from = new Date('2026-11-24T00:00:00Z');
    expect(daysFromNow(7, from).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});
