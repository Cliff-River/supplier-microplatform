import { describe, expect, it, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function uploadService(attachment: Record<string, unknown> | null = null) {
  const storageDir = join(tmpdir(), `supplier-microplatform-upload-${Date.now()}`);
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'att-new',
    createdAt: new Date(),
    ...data,
  }));
  const deleteMock = vi.fn(async () => ({ id: 'att1' }));
  const prisma = {
    attachment: {
      findUnique: vi.fn(async () => attachment),
      create,
      delete: deleteMock,
    },
  };
  const uploadEnv = {
    ...env,
    STORAGE_DIR: storageDir,
  } as unknown as Env;
  return {
    storage: new StorageService(uploadEnv, prisma as unknown as PrismaService),
    create,
    deleteMock,
    storageDir,
  };
}

function uploadFile(
  originalname: string,
  mimetype: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    mimetype,
    size: 4,
    buffer: Buffer.from('test'),
  } as Express.Multer.File;
}

describe('StorageService 上传白名单', () => {
  it('拒绝不在白名单内的扩展名', async () => {
    const { storage } = uploadService();
    await expect(
      storage.save(uploadFile('payload.exe', 'application/octet-stream'), {
        type: 'INTERNAL',
        id: 'u1',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FILE_TYPE_NOT_ALLOWED,
    });
  });

  it('拒绝扩展名与 MIME 不匹配的文件', async () => {
    const { storage } = uploadService();
    await expect(
      storage.save(uploadFile('contract.pdf', 'image/png'), {
        type: 'INTERNAL',
        id: 'u1',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FILE_TYPE_NOT_ALLOWED });
  });

  it('接受白名单文件并清洗文件名', async () => {
    const { storage, create, storageDir } = uploadService();
    try {
      const saved = await storage.save(
        uploadFile('../../etc/passwd.pdf', 'application/pdf'),
        { type: 'INTERNAL', id: 'u1' },
      );
      expect(saved.fileName).not.toContain('/');
      expect(saved.fileName.endsWith('.pdf')).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      const data = create.mock.calls[0]?.[0]?.data as {
        storageKey: string;
      };
      await rm(join(storageDir, data.storageKey));
    } finally {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it('空文件名回退为 file', async () => {
    const { storage, create } = uploadService();
    await expect(
      storage.save(uploadFile('   ', 'application/pdf'), {
        type: 'INTERNAL',
        id: 'u1',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FILE_TYPE_NOT_ALLOWED });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('StorageService.deleteTemp', () => {
  const tempAttachment = {
    id: 'att2',
    scope: 'TEMP',
    storageKey: '2026/01/att2.pdf',
    uploadedByType: 'INTERNAL',
    uploadedById: 'u1',
  };

  it('上传者可删除自己的临时附件', async () => {
    const { storage, deleteMock } = uploadService(tempAttachment);
    await expect(
      storage.deleteTemp('att2', { type: 'INTERNAL', id: 'u1' }),
    ).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'att2' } });
  });

  it('非上传者不能删除', async () => {
    const { storage, deleteMock } = uploadService(tempAttachment);
    await expect(
      storage.deleteTemp('att2', { type: 'INTERNAL', id: 'u2' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('已绑定业务的附件不能删除', async () => {
    const { storage, deleteMock } = uploadService({
      ...tempAttachment,
      scope: 'PROJECT',
    });
    await expect(
      storage.deleteTemp('att2', { type: 'INTERNAL', id: 'u1' }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('附件不存在返回 NOT_FOUND', async () => {
    const { storage } = uploadService(null);
    await expect(
      storage.deleteTemp('missing', { type: 'INTERNAL', id: 'u1' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
