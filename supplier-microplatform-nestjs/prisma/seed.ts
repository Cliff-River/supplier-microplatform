import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createInternalAuth } from '../src/auth/auth.config.js';
import type { MailService } from '../src/mail/mail.service.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const mailStub = {
  sendPasswordReset: async () => undefined,
} as unknown as MailService;

async function seedAdmin(): Promise<void> {
  const existing = await prisma.internalUser.findFirst({
    where: {
      OR: [{ email: env.SEED_ADMIN_EMAIL }, { username: env.SEED_ADMIN_USERNAME }],
    },
  });

  if (existing) {
    await prisma.internalUser.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', isActive: true, mustChangePassword: false },
    });
    console.log(`管理员已存在: ${existing.username}`);
    return;
  }

  const auth = createInternalAuth(prisma, mailStub);
  const result = await auth.api.signUpEmail({
    body: {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      name: '系统管理员',
      username: env.SEED_ADMIN_USERNAME,
      displayUsername: env.SEED_ADMIN_USERNAME,
    } as never,
  });
  const userId = (result as { user: { id: string } }).user.id;
  await prisma.internalUser.update({
    where: { id: userId },
    data: { role: 'ADMIN', emailVerified: true, mustChangePassword: false },
  });
  console.log(
    `已创建管理员 ${env.SEED_ADMIN_USERNAME}（${env.SEED_ADMIN_EMAIL}）`,
  );
}

async function seedSettings(): Promise<void> {
  const defaults: Array<[string, string]> = [
    ['platform.name', '供应商微平台'],
    ['platform.contactName', '平台管理员'],
    ['platform.contactPhone', ''],
    ['platform.contactEmail', env.SEED_ADMIN_EMAIL],
    ['mail.footerNote', '本邮件由系统自动发送，请勿直接回复。'],
  ];
  for (const [key, value] of defaults) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedSettings();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
