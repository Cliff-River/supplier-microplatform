import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { shanghaiDateStamp } from '../common/utils/codes.js';

export interface Uploader {
  type: 'INTERNAL' | 'SUPPLIER';
  id: string;
}

export interface SaveFileOptions {
  scope?: 'TEMP' | 'PROJECT' | 'INQUIRY' | 'QUOTE' | 'CONTRACT' | 'ORDER' | 'INVOICE' | 'SUPPLIER';
  scopeId?: string | null;
  kind?:
    | 'GENERAL'
    | 'QUOTE_FILE'
    | 'CONTRACT_FILE'
    | 'ACCEPTANCE_FILE'
    | 'SIGNED_ACCEPTANCE'
    | 'INVOICE_FILE'
    | 'PAYMENT_REQUEST';
  expiresAt?: Date | null;
}

/** 允许上传的扩展名与 MIME 类型白名单（必须成对匹配）。 */
const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_MIME_TYPES).join('、');

/** 去掉路径与非法字符，保留扩展名并限制长度。 */
function sanitizeFileName(name: string): string {
  const stripped = Array.from(name)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
  const base = stripped
    .replace(/[\\/]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .trim();
  const sanitized = base.slice(-200);
  return sanitized.length > 0 ? sanitized : 'file';
}

function assertAllowedUpload(fileName: string, mimeType: string): void {
  const extension = extname(fileName).toLowerCase();
  const allowedMimes = ALLOWED_MIME_TYPES[extension];
  if (!allowedMimes) {
    throw new AppException(
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
      `不支持的文件类型，仅允许 ${ALLOWED_EXTENSIONS}`,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
  if (!allowedMimes.includes(mimeType.toLowerCase())) {
    throw new AppException(
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
      '文件 MIME 类型与扩展名不匹配',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly root: string;
  private readonly signingSecret: string;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {
    this.root = resolve(process.cwd(), env.STORAGE_DIR);
    this.signingSecret = env.FILE_SIGNING_SECRET ?? env.INTERNAL_AUTH_SECRET;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureReady();
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async save(
    file: Express.Multer.File,
    uploader: Uploader,
    options: SaveFileOptions = {},
  ) {
    if (!file?.buffer) {
      throw AppException.validation('未收到文件');
    }
    const fileName = sanitizeFileName(file.originalname);
    assertAllowedUpload(fileName, file.mimetype || '');
    const now = new Date();
    const stamp = shanghaiDateStamp(now);
    const dir = join(stamp.slice(0, 4), stamp.slice(4, 6));
    await mkdir(join(this.root, dir), { recursive: true });

    const extension = extname(fileName).slice(0, 16);
    const storageKey = join(dir, `${randomUUID()}${extension}`);
    await writeFile(join(this.root, storageKey), file.buffer);

    return this.prisma.attachment.create({
      data: {
        scope: options.scope ?? 'TEMP',
        scopeId: options.scopeId ?? null,
        kind: options.kind ?? 'GENERAL',
        fileName,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey,
        uploadedByType: uploader.type,
        uploadedById: uploader.id,
        expiresAt:
          options.expiresAt ??
          (options.scope && options.scope !== 'TEMP'
            ? null
            : new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      },
    });
  }

  async remove(attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) return;
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    try {
      await unlink(join(this.root, attachment.storageKey));
    } catch {
      // 文件可能已被清理，忽略
    }
  }

  /** 删除本人上传且尚未绑定业务的临时附件。 */
  async deleteTemp(attachmentId: string, uploader: Uploader): Promise<void> {
    const attachment = await this.getOrThrow(attachmentId);
    if (
      attachment.uploadedByType !== uploader.type ||
      attachment.uploadedById !== uploader.id
    ) {
      throw AppException.forbidden('附件不属于当前账号');
    }
    if (attachment.scope !== 'TEMP') {
      throw AppException.invalidState('仅未绑定业务的临时附件可删除');
    }
    await this.remove(attachmentId);
  }

  streamFor(storageKey: string) {
    return createReadStream(join(this.root, storageKey));
  }

  /** 供邮件附件使用：返回磁盘绝对路径 */
  absolutePath(storageKey: string): string {
    return join(this.root, storageKey);
  }

  sign(attachmentId: string, expiresAtSeconds: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${attachmentId}.${expiresAtSeconds}`)
      .digest('hex');
  }

  createSignedUrl(
    attachmentId: string,
    ttlSeconds = 300,
  ): { url: string; expiresAt: number } {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(attachmentId, expiresAt);
    return {
      url: `/api/files/${attachmentId}/download?expires=${expiresAt}&signature=${signature}`,
      expiresAt,
    };
  }

  verifySignature(
    attachmentId: string,
    expires: number,
    signature: string,
  ): boolean {
    if (!Number.isFinite(expires) || expires * 1000 < Date.now()) {
      return false;
    }
    const expected = Buffer.from(this.sign(attachmentId, expires));
    const received = Buffer.from(signature ?? '');
    if (expected.length !== received.length) {
      return false;
    }
    if (!timingSafeEqual(expected, received)) {
      return false;
    }
    return true;
  }

  async bind(
    attachmentIds: string[],
    scope: 'PROJECT' | 'INQUIRY' | 'QUOTE' | 'CONTRACT' | 'ORDER' | 'INVOICE' | 'SUPPLIER',
    scopeId: string,
    kind: SaveFileOptions['kind'],
    uploader: Uploader,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
    const attachments = await this.prisma.attachment.findMany({
      where: { id: { in: attachmentIds } },
    });
    if (attachments.length !== new Set(attachmentIds).size) {
      throw AppException.notFound('附件不存在');
    }
    for (const attachment of attachments) {
      if (
        attachment.uploadedByType !== uploader.type ||
        attachment.uploadedById !== uploader.id
      ) {
        throw AppException.forbidden('附件不属于当前账号');
      }
      if (attachment.scope !== 'TEMP') {
        throw AppException.invalidState('附件已被使用');
      }
    }
    await this.prisma.attachment.updateMany({
      where: { id: { in: attachmentIds } },
      data: {
        scope,
        scopeId,
        kind: kind ?? 'GENERAL',
        expiresAt: null,
      },
    });
  }

  async canAccess(
    attachmentId: string,
    user: { kind: 'INTERNAL' | 'SUPPLIER'; id: string; supplierId?: string },
  ): Promise<boolean> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) return false;
    if (attachment.uploadedByType === 'INTERNAL' && user.kind === 'INTERNAL') {
      return true;
    }
    if (
      attachment.uploadedByType === user.kind &&
      attachment.uploadedById === user.id
    ) {
      return true;
    }
    // 内部用户共享查看全部业务数据，可访问任意已绑定业务的附件；
    // 临时附件仍只允许上传者本人访问。
    if (user.kind === 'INTERNAL') {
      return attachment.scope !== 'TEMP';
    }
    if (attachment.uploadedByType === 'SUPPLIER' && user.kind === 'SUPPLIER') {
      const uploader = await this.prisma.supplierUser.findUnique({
        where: { id: attachment.uploadedById },
        select: { supplierId: true },
      });
      return Boolean(
        uploader && user.supplierId && uploader.supplierId === user.supplierId,
      );
    }
    return false;
  }

  async getOrThrow(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw AppException.notFound('附件不存在');
    }
    return attachment;
  }

  assertSignature(
    attachmentId: string,
    expires: number,
    signature: string,
  ): void {
    if (!this.verifySignature(attachmentId, expires, signature)) {
      throw new AppException(
        ErrorCode.INVALID_FILE_SIGNATURE,
        '下载链接无效或已过期',
        403,
      );
    }
  }
}
