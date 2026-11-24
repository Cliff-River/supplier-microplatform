import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3100),
  APP_URL: z.url().default('http://localhost:3000'),
  INTERNAL_AUTH_SECRET: z.string().min(32),
  SUPPLIER_AUTH_SECRET: z.string().min(32),
  FILE_SIGNING_SECRET: z.string().min(32).optional(),
  MAIL_HOST: z.string().default('127.0.0.1'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_USER: z.string().optional().default(''),
  MAIL_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('供应商微平台 <no-reply@local.test>'),
  STORAGE_DIR: z.string().default('./storage/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(20),
  SEED_ADMIN_EMAIL: z.email().default('admin@local.test'),
  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin12345'),
  TZ: z.string().default('Asia/Shanghai'),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('APP_ENV');

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败: ${details}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
