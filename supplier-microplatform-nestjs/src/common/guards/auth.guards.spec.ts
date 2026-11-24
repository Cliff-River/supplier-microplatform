import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InternalAuthGuard } from './internal-auth.guard.js';
import { SupplierAuthGuard } from './supplier-auth.guard.js';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function contextWithRequest(): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = { headers: {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function internalGuard(options: {
  session: unknown;
  user: unknown;
  otherSession?: unknown;
}): InternalAuthGuard {
  const auth = { api: { getSession: vi.fn(async () => options.session) } };
  const otherAuth = {
    api: { getSession: vi.fn(async () => options.otherSession ?? null) },
  };
  const prisma = {
    internalUser: { findUnique: vi.fn(async () => options.user) },
  };
  return new InternalAuthGuard(
    auth as never,
    otherAuth as never,
    prisma as unknown as PrismaService,
  );
}

function supplierGuard(options: {
  session: unknown;
  user: unknown;
  otherSession?: unknown;
}): { guard: SupplierAuthGuard; request: Record<string, unknown> } {
  const auth = { api: { getSession: vi.fn(async () => options.session) } };
  const otherAuth = {
    api: { getSession: vi.fn(async () => options.otherSession ?? null) },
  };
  const prisma = {
    supplierUser: { findUnique: vi.fn(async () => options.user) },
  };
  const guard = new SupplierAuthGuard(
    auth as never,
    otherAuth as never,
    prisma as unknown as PrismaService,
  );
  const { context, request } = contextWithRequest();
  (guard as unknown as { context: ExecutionContext }).context = context;
  return { guard, request };
}

const activeInternalUser = {
  id: 'u1',
  name: '管理员',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
  phone: null,
  isActive: true,
  mustChangePassword: false,
  deletedAt: null,
};

const activeSupplierUser = {
  id: 's1',
  name: '张三',
  email: 'supplier@example.com',
  username: 'supplier_a',
  supplierId: 'sup1',
  phone: '13800000000',
  title: '销售',
  isPrimary: true,
  isActive: true,
  mustChangePassword: false,
  deletedAt: null,
};

async function expectAppException(
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => {
    expect(error.code).toBe(code);
    expect(error.getStatus()).toBe(status);
  });
}

describe('InternalAuthGuard', () => {
  it('无会话返回未登录', async () => {
    const guard = internalGuard({ session: null, user: null });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.UNAUTHENTICATED,
      401,
    );
  });

  it('供应商会话访问内部接口返回 403', async () => {
    const guard = internalGuard({
      session: null,
      user: null,
      otherSession: { user: { id: 's1' } },
    });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.FORBIDDEN,
      403,
    );
  });

  it('账号停用返回 ACCOUNT_DISABLED', async () => {
    const guard = internalGuard({
      session: { user: { id: 'u1' } },
      user: { ...activeInternalUser, isActive: false },
    });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.ACCOUNT_DISABLED,
      403,
    );
  });

  it('首次登录未改密返回 PASSWORD_CHANGE_REQUIRED', async () => {
    const guard = internalGuard({
      session: { user: { id: 'u1' } },
      user: { ...activeInternalUser, mustChangePassword: true },
    });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.PASSWORD_CHANGE_REQUIRED,
      403,
    );
  });

  it('通过后写入内部用户上下文', async () => {
    const guard = internalGuard({
      session: { user: { id: 'u1' } },
      user: activeInternalUser,
    });
    const { context, request } = contextWithRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authUser).toMatchObject({
      kind: 'INTERNAL',
      id: 'u1',
      role: 'ADMIN',
    });
  });
});

describe('SupplierAuthGuard', () => {
  it('通过后写入供应商上下文并携带 supplierId', async () => {
    const auth = {
      api: { getSession: vi.fn(async () => ({ user: { id: 's1' } })) },
    };
    const prisma = {
      supplierUser: { findUnique: vi.fn(async () => activeSupplierUser) },
    };
    const guard = new SupplierAuthGuard(
      auth as never,
      { api: { getSession: vi.fn(async () => null) } } as never,
      prisma as unknown as PrismaService,
    );
    const { context, request } = contextWithRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authUser).toMatchObject({
      kind: 'SUPPLIER',
      id: 's1',
      supplierId: 'sup1',
    });
  });

  it('供应商账号停用返回 ACCOUNT_DISABLED', async () => {
    const { guard } = supplierGuard({
      session: { user: { id: 's1' } },
      user: { ...activeSupplierUser, isActive: false },
    });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.ACCOUNT_DISABLED,
      403,
    );
  });

  it('内部会话访问供应商接口返回 403', async () => {
    const { guard } = supplierGuard({
      session: null,
      user: null,
      otherSession: { user: { id: 'u1' } },
    });
    const { context } = contextWithRequest();
    await expectAppException(
      guard.canActivate(context),
      ErrorCode.FORBIDDEN,
      403,
    );
  });
});
