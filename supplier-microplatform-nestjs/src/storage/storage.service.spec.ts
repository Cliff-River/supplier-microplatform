import { describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const env = {
  STORAGE_DIR: '/tmp/supplier-microplatform-test',
  FILE_SIGNING_SECRET: 's'.repeat(32),
  INTERNAL_AUTH_SECRET: 'i'.repeat(32),
} as unknown as Env;

function service(options: {
  attachment: Record<string, unknown> | null;
  uploaderSupplierId?: string | null;
}): StorageService {
  const prisma = {
    attachment: { findUnique: vi.fn(async () => options.attachment) },
    supplierUser: {
      findUnique: vi.fn(async () => ({
        supplierId: options.uploaderSupplierId ?? 'sup1',
      })),
    },
  };
  return new StorageService(env, prisma as unknown as PrismaService);
}

const supplierContract = {
  id: 'att1',
  scope: 'CONTRACT',
  uploadedByType: 'SUPPLIER',
  uploadedById: 's1',
};

const supplierTemp = {
  id: 'att2',
  scope: 'TEMP',
  uploadedByType: 'SUPPLIER',
  uploadedById: 's1',
};

describe('StorageService.canAccess', () => {
  it('内部用户可访问供应商上传的已绑定附件', async () => {
    const storage = service({ attachment: supplierContract });
    await expect(
      storage.canAccess('att1', { kind: 'INTERNAL', id: 'u1' }),
    ).resolves.toBe(true);
  });

  it('内部用户不能访问他人的临时附件', async () => {
    const storage = service({ attachment: supplierTemp });
    await expect(
      storage.canAccess('att2', { kind: 'INTERNAL', id: 'u1' }),
    ).resolves.toBe(false);
  });

  it('供应商可访问同企业附件，不能访问其他企业附件', async () => {
    const same = service({ attachment: supplierContract });
    const other = service({
      attachment: { ...supplierContract, uploadedById: 's2' },
      uploaderSupplierId: 'sup2',
    });

    await expect(
      same.canAccess('att1', { kind: 'SUPPLIER', id: 's1', supplierId: 'sup1' }),
    ).resolves.toBe(true);
    await expect(
      other.canAccess('att1', { kind: 'SUPPLIER', id: 's1', supplierId: 'sup1' }),
    ).resolves.toBe(false);
  });
});

describe('StorageService 签名', () => {
  it('生成的签名可通过校验', () => {
    const storage = service({ attachment: supplierContract });
    const { url } = storage.createSignedUrl('att1', 300);
    const query = new URLSearchParams(url.split('?')[1]);
    const expires = Number(query.get('expires'));
    const signature = query.get('signature') ?? '';

    expect(storage.verifySignature('att1', expires, signature)).toBe(true);
  });

  it('篡改签名返回 INVALID_FILE_SIGNATURE', () => {
    const storage = service({ attachment: supplierContract });
    const { expiresAt } = storage.createSignedUrl('att1', 300);

    expect(() =>
      storage.assertSignature('att1', expiresAt, 'tampered'),
    ).toThrowError(AppException);
    try {
      storage.assertSignature('att1', expiresAt, 'tampered');
    } catch (error) {
      const appError = error as AppException;
      expect(appError.code).toBe(ErrorCode.INVALID_FILE_SIGNATURE);
      expect(appError.getStatus()).toBe(403);
    }
  });

  it('过期链接校验失败', () => {
    const storage = service({ attachment: supplierContract });
    const past = Math.floor(Date.now() / 1000) - 10;
    const signature = (storage as unknown as {
      sign: (id: string, expires: number) => string;
    }).sign('att1', past);

    expect(storage.verifySignature('att1', past, signature)).toBe(false);
  });
});
