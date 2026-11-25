import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  renderAccountCreated,
  renderInquiryOpened,
  renderLayout,
  renderQuoteSubmitted,
} from './mail-templates.js';

const brand = { appName: '供应商微平台', appUrl: 'http://localhost:3000' };

describe('mail-templates', () => {
  it('escapeHtml 转义特殊字符', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;',
    );
  });

  it('renderLayout 渲染表格、按钮、备注与联系方式', () => {
    const result = renderLayout({
      brand,
      title: '标题',
      intro: '正文',
      rows: [['字段', '值']],
      note: '注意事项',
      actionText: '前往',
      actionUrl: 'http://localhost:3000/x',
      contactName: '张三',
      contactEmail: 'z@local.test',
    });
    expect(result.html).toContain('值');
    expect(result.html).toContain('注意事项');
    expect(result.html).toContain('http://localhost:3000/x');
    expect(result.html).toContain('张三 / z@local.test');
    expect(result.text).toContain('字段: 值');
  });

  it('renderLayout 对变量做 HTML 转义', () => {
    const result = renderLayout({
      brand,
      title: '<script>',
      intro: 'a & b',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('账号创建邮件包含初始密码与主题', () => {
    const result = renderAccountCreated(brand, {
      name: '李四',
      username: 'user1',
      password: 'Init12345',
      loginUrl: 'http://localhost:3000/login',
      isSupplier: true,
    });
    expect(result.subject).toContain('账号已开通');
    expect(result.html).toContain('Init12345');
  });

  it('询价邮件包含项目、数量与截止时间', () => {
    const result = renderInquiryOpened(brand, {
      projectName: '项目',
      projectCode: 'PRJ-1',
      inquiryTitle: '询价',
      description: '要求',
      quantity: '10',
      unit: '件',
      deadline: '2026-11-30 12:00',
      inquiryUrl: 'http://localhost:3000/i/1',
      supplierName: '供应商A',
    });
    expect(result.subject).toBe('【询价】项目 - 询价');
    expect(result.html).toContain('10 件');
    expect(result.html).toContain('2026-11-30 12:00');
  });

  it('报价邮件包含单价、总价与版本', () => {
    const result = renderQuoteSubmitted(brand, {
      projectName: '项目',
      inquiryTitle: '询价',
      supplierName: '供应商A',
      unitPrice: '10.00',
      totalPrice: '100.00',
      currency: 'CNY',
      deliveryDays: 5,
      version: 2,
      quoteUrl: 'http://localhost:3000/q/1',
    });
    expect(result.subject).toContain('供应商A 已提交报价');
    expect(result.html).toContain('CNY 100.00');
    expect(result.html).toContain('第 2 版');
  });
});
