const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 返回 Asia/Shanghai 时区下的 YYYYMMDD */
export function shanghaiDateStamp(date = new Date()): string {
  const local = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = `${local.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${local.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

export function dailyCode(prefix: string, seq: number, date = new Date()): string {
  return `${prefix}-${shanghaiDateStamp(date)}-${`${seq}`.padStart(4, '0')}`;
}

export function daysFromNow(days: number, from = new Date()): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** 生成形如 PREFIX-YYYYMMDD-0001 的日序号业务编号 */
export async function generateDailyCode(
  prefix: string,
  exists: (code: string) => Promise<boolean>,
  date = new Date(),
): Promise<string> {
  for (let i = 1; i <= 200; i += 1) {
    const code = `${prefix}-${shanghaiDateStamp(date)}-${`${i}`.padStart(4, '0')}`;
    if (!(await exists(code))) return code;
  }
  return `${prefix}-${shanghaiDateStamp(date)}-${Date.now().toString().slice(-6)}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** 以 Asia/Shanghai 展示日期时间，用于邮件等文本 */
export function formatShanghaiDateTime(date?: Date | null): string {
  if (!date) return '-';
  return dateTimeFormatter.format(date);
}
