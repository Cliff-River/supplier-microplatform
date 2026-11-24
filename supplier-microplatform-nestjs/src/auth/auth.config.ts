import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MailService } from '../mail/mail.service.js';
import { env } from '../config/env.js';

const trustedOrigins = [env.APP_URL, `http://localhost:${env.PORT}`];

function baseOptions() {
  return {
    appName: '供应商微平台',
    baseURL: env.APP_URL,
    trustedOrigins,
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
  };
}

export function createInternalAuth(prisma: PrismaService, mail: MailService) {
  return betterAuth({
    ...baseOptions(),
    basePath: '/api/auth/internal',
    secret: env.INTERNAL_AUTH_SECRET,
    database: prismaAdapter(prisma as never, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, token }) => {
        await mail.sendPasswordReset('INTERNAL', [user.email], {
          name: user.name,
          token,
        });
      },
    },
    user: {
      modelName: 'internalUser',
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: 'MEMBER',
        },
        phone: { type: 'string', required: false, input: false },
        isActive: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: true,
        },
        mustChangePassword: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: true,
        },
        deletedAt: { type: 'date', required: false, input: false },
      },
    },
    session: { modelName: 'internalSession' },
    account: { modelName: 'internalAccount' },
    verification: { modelName: 'internalVerification' },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
    advanced: {
      cookiePrefix: 'internal',
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session: { userId?: string }) => {
            if (!session.userId) return;
            const user = await prisma.internalUser.findUnique({
              where: { id: session.userId },
              select: { isActive: true, deletedAt: true },
            });
            if (!user || !user.isActive || user.deletedAt) {
              throw new APIError('FORBIDDEN', {
                message: '账号已停用，请联系管理员',
              });
            }
          },
        },
      },
      account: {
        update: {
          after: async (account: { userId?: string; password?: string | null }) => {
            if (account.password && account.userId) {
              await prisma.internalUser.updateMany({
                where: { id: account.userId },
                data: { mustChangePassword: false },
              });
            }
          },
        },
      },
    },
  });
}

export function createSupplierAuth(prisma: PrismaService, mail: MailService) {
  return betterAuth({
    ...baseOptions(),
    basePath: '/api/auth/supplier',
    secret: env.SUPPLIER_AUTH_SECRET,
    database: prismaAdapter(prisma as never, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, token }) => {
        await mail.sendPasswordReset('SUPPLIER', [user.email], {
          name: user.name,
          token,
        });
      },
    },
    user: {
      modelName: 'supplierUser',
      additionalFields: {
        supplierId: { type: 'string', required: false, input: true },
        phone: { type: 'string', required: false, input: false },
        title: { type: 'string', required: false, input: false },
        isPrimary: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: false,
        },
        isActive: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: true,
        },
        mustChangePassword: {
          type: 'boolean',
          required: false,
          input: false,
          defaultValue: true,
        },
        deletedAt: { type: 'date', required: false, input: false },
      },
    },
    session: { modelName: 'supplierSession' },
    account: { modelName: 'supplierAccount' },
    verification: { modelName: 'supplierVerification' },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
    advanced: {
      cookiePrefix: 'supplier',
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session: { userId?: string }) => {
            if (!session.userId) return;
            const user = await prisma.supplierUser.findUnique({
              where: { id: session.userId },
              select: { isActive: true, deletedAt: true },
            });
            if (!user || !user.isActive || user.deletedAt) {
              throw new APIError('FORBIDDEN', {
                message: '账号已停用，请联系采购方管理员',
              });
            }
          },
        },
      },
      account: {
        update: {
          after: async (account: { userId?: string; password?: string | null }) => {
            if (account.password && account.userId) {
              await prisma.supplierUser.updateMany({
                where: { id: account.userId },
                data: { mustChangePassword: false },
              });
            }
          },
        },
      },
    },
  });
}
