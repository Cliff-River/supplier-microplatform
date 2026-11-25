import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SettingsService } from '../modules/settings/settings.service.js';
import type { Env } from '../config/env.js';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

const env = {
  MAIL_HOST: 'localhost',
  MAIL_PORT: 1025,
  MAIL_SECURE: false,
  MAIL_USER: undefined,
  MAIL_PASS: undefined,
  MAIL_FROM: 'no-reply@local.test',
} as unknown as Env;

function service() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'log1',
    ...data,
  }));
  const update = vi.fn(async () => ({}));
  const findUnique = vi.fn();
  const prisma = {
    mailLog: { create, update, findUnique },
  };
  const settings = {
    getPlatformInfo: vi.fn(async () => ({
      name: '供应商微平台',
      url: 'http://localhost:3000',
    })),
  };
  const mail = new MailService(
    env,
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
  );
  return { mail, create, update, findUnique };
}

describe('MailService.send', () => {
  beforeEach(() => {
    sendMail.mockReset();
  });

  it('没有有效收件人时跳过并返回 null', async () => {
    const { mail, create } = service();
    await expect(
      mail.send({
        templateKey: 't',
        to: ['invalid', ' ', 'invalid'],
        subject: 's',
        html: 'h',
        text: 't',
      }),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('去重并过滤非法邮箱后发送成功', async () => {
    const { mail, create, update } = service();
    sendMail.mockResolvedValue({});
    const result = await mail.send({
      templateKey: 'quote.submitted',
      to: ['A@local.test', 'a@local.test', 'bad', 'b@local.test'],
      cc: ['c@local.test'],
      subject: 's',
      html: 'h',
      text: 't',
      relatedType: 'quote',
      relatedId: 'q1',
    });

    expect(result).toEqual({ id: 'log1', status: 'SENT' });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toEmails: 'A@local.test,b@local.test',
        ccEmails: 'c@local.test',
        status: 'PENDING',
        relatedType: 'quote',
        relatedId: 'q1',
      }),
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@local.test',
        to: ['A@local.test', 'b@local.test'],
        cc: ['c@local.test'],
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log1' },
      data: expect.objectContaining({ status: 'SENT', attempts: { increment: 1 } }),
    });
  });

  it('发送失败时记录 FAILED 与错误信息', async () => {
    const { mail, update } = service();
    sendMail.mockRejectedValue(new Error('smtp down'));
    const result = await mail.send({
      templateKey: 't',
      to: ['a@local.test'],
      subject: 's',
      html: 'h',
      text: 't',
    });
    expect(result).toEqual({ id: 'log1', status: 'FAILED' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log1' },
      data: expect.objectContaining({ status: 'FAILED', error: 'smtp down' }),
    });
  });
});

describe('MailService.retry', () => {
  beforeEach(() => {
    sendMail.mockReset();
  });

  it('日志不存在时抛出错误', async () => {
    const { mail, findUnique } = service();
    findUnique.mockResolvedValueOnce(null);
    await expect(mail.retry('missing')).rejects.toThrow('邮件日志不存在');
  });

  it('重试成功后更新状态', async () => {
    const { mail, findUnique, update } = service();
    findUnique.mockResolvedValueOnce({
      id: 'log1',
      toEmails: 'a@local.test',
      ccEmails: null,
      subject: 's',
      payload: { html: 'h', text: 't' },
    });
    sendMail.mockResolvedValue({});

    await expect(mail.retry('log1')).resolves.toEqual({ status: 'SENT' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log1' },
      data: expect.objectContaining({ status: 'SENT' }),
    });
  });

  it('重试失败时返回 FAILED', async () => {
    const { mail, findUnique, update } = service();
    findUnique.mockResolvedValueOnce({
      id: 'log1',
      toEmails: 'a@local.test',
      ccEmails: 'c@local.test',
      subject: 's',
      payload: null,
    });
    sendMail.mockRejectedValue(new Error('timeout'));

    await expect(mail.retry('log1')).resolves.toEqual({ status: 'FAILED' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'log1' },
      data: expect.objectContaining({ status: 'FAILED', error: 'timeout' }),
    });
  });
});

describe('MailService 账号邮件', () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({});
  });

  it('内部账号创建邮件返回发送状态', async () => {
    const { mail } = service();
    await expect(
      mail.sendAccountCreated('INTERNAL', ['a@local.test'], {
        name: '张三',
        username: 'zhangsan',
        password: 'Init12345',
      }),
    ).resolves.toEqual({ status: 'SENT' });
  });

  it('供应商账号创建邮件使用供应商登录地址', async () => {
    const { mail } = service();
    await expect(
      mail.sendAccountCreated('SUPPLIER', ['s@local.test'], {
        name: '供应商',
        username: 'sup',
        password: 'Init12345',
      }),
    ).resolves.toEqual({ status: 'SENT' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('http://localhost:3000/supplier/login'),
      }),
    );
  });

  it('重置密码邮件按角色拼接链接', async () => {
    const { mail } = service();
    await mail.sendPasswordReset('SUPPLIER', ['s@local.test'], {
      name: '供应商',
      token: 'a b',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          'http://localhost:3000/supplier/reset-password?token=a%20b',
        ),
      }),
    );
  });
});
