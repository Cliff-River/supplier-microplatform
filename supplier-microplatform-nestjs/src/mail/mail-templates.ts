export interface MailBrand {
  appName: string;
  appUrl: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface LayoutOptions {
  brand: MailBrand;
  title: string;
  intro: string;
  rows?: Array<[string, string]>;
  note?: string;
  actionText?: string;
  actionUrl?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export function renderLayout(options: LayoutOptions): { html: string; text: string } {
  const {
    brand,
    title,
    intro,
    rows = [],
    note,
    actionText,
    actionUrl,
    contactName,
    contactPhone,
    contactEmail,
  } = options;

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">${escapeHtml(
          label,
        )}</td><td style="padding:6px 12px;color:#111827;">${escapeHtml(
          value,
        )}</td></tr>`,
    )
    .join('');

  const button =
    actionText && actionUrl
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(
          actionUrl,
        )}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;">${escapeHtml(
          actionText,
        )}</a></p>`
      : '';

  const contactLine = [contactName, contactPhone, contactEmail]
    .filter(Boolean)
    .join(' / ');

  const html = `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      <p style="margin:0 0 4px;color:#2563eb;font-weight:600;">${escapeHtml(brand.appName)}</p>
      <h1 style="margin:8px 0 16px;font-size:20px;color:#111827;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;color:#374151;line-height:1.6;">${escapeHtml(intro)}</p>
      ${rowsHtml ? `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;">${rowsHtml}</table>` : ''}
      ${note ? `<p style="margin:16px 0 0;color:#b45309;line-height:1.6;">${escapeHtml(note)}</p>` : ''}
      ${button}
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
        如有疑问，请联系 ${escapeHtml(contactLine || '平台管理员')}。
      </p>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
        本邮件由系统自动发送，请勿直接回复。
      </p>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
        ${escapeHtml(brand.appUrl)}
      </p>
    </div>
  </body>
</html>`;

  const textLines = [
    brand.appName,
    title,
    '',
    intro,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    note ? `\n${note}` : '',
    actionText && actionUrl ? `\n${actionText}: ${actionUrl}` : '',
    '',
    `如有疑问，请联系 ${contactLine || '平台管理员'}。`,
    '本邮件由系统自动发送，请勿直接回复。',
  ];

  return { html, text: textLines.filter((line) => line !== undefined).join('\n') };
}

export function renderAccountCreated(
  brand: MailBrand,
  data: { name: string; username: string; password: string; loginUrl: string; isSupplier: boolean },
): { html: string; text: string; subject: string } {
  return {
    subject: `【账号】${brand.appName} 账号已开通`,
    ...renderLayout({
      brand,
      title: '账号已开通',
      intro: `${data.name}，您好！您的${data.isSupplier ? '供应商' : '内部'}账号已创建。`,
      rows: [
        ['用户名', data.username],
        ['一次性初始密码', data.password],
        ['登录地址', data.loginUrl],
      ],
      note: '首次登录后需要修改密码，修改成功前无法访问其他功能。',
      actionText: '前往登录',
      actionUrl: data.loginUrl,
    }),
  };
}

export function renderPasswordReset(
  brand: MailBrand,
  data: { name: string; resetUrl: string },
): { html: string; text: string; subject: string } {
  return {
    subject: `【账号】${brand.appName} 重置密码`,
    ...renderLayout({
      brand,
      title: '重置密码',
      intro: `${data.name}，您好！我们收到了重置密码的请求，请点击下方按钮设置新密码。`,
      note: '链接在 1 小时内有效。如非本人操作，请忽略本邮件。',
      actionText: '重置密码',
      actionUrl: data.resetUrl,
    }),
  };
}

export interface ProjectContact {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export function renderInquiryOpened(
  brand: MailBrand,
  data: ProjectContact & {
    projectName: string;
    projectCode: string;
    inquiryTitle: string;
    description?: string | null;
    quantity: string;
    unit: string;
    deadline: string;
    inquiryUrl: string;
    supplierName: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【询价】${data.projectName} - ${data.inquiryTitle}`,
    ...renderLayout({
      brand,
      title: '您收到一条新的询价邀请',
      intro: `${data.supplierName}，您好！采购方已向您发送询价邀请，请在截止时间前登录平台提交报价。`,
      rows: [
        ['项目', `${data.projectName}（${data.projectCode}）`],
        ['询价项', data.inquiryTitle],
        ['数量', `${data.quantity} ${data.unit}`],
        ['截止时间', data.deadline],
        ...(data.description ? [['询价要求', data.description] as [string, string]] : []),
      ],
      note: '报价截止后无法再提交或修改，请合理安排时间。',
      actionText: '查看询价并报价',
      actionUrl: data.inquiryUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderQuoteSubmitted(
  brand: MailBrand,
  data: ProjectContact & {
    projectName: string;
    inquiryTitle: string;
    supplierName: string;
    unitPrice: string;
    totalPrice: string;
    currency: string;
    deliveryDays?: number | null;
    validUntil?: string | null;
    note?: string | null;
    version: number;
    quoteUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【报价】${data.supplierName} 已提交报价 - ${data.inquiryTitle}`,
    ...renderLayout({
      brand,
      title: '供应商提交了新的报价',
      intro: `${data.supplierName} 已针对「${data.inquiryTitle}」提交第 ${data.version} 版报价。`,
      rows: [
        ['项目', data.projectName],
        ['询价项', data.inquiryTitle],
        ['供应商', data.supplierName],
        ['单价', `${data.currency} ${data.unitPrice}`],
        ['总价', `${data.currency} ${data.totalPrice}`],
        ...(data.deliveryDays != null ? [['交期', `${data.deliveryDays} 天`] as [string, string]] : []),
        ...(data.validUntil ? [['报价有效期', data.validUntil] as [string, string]] : []),
        ...(data.note ? [['补充说明', data.note] as [string, string]] : []),
      ],
      actionText: '查看报价对比',
      actionUrl: data.quoteUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderOrderCreated(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    projectName: string;
    inquiryTitle: string;
    amount: string;
    currency: string;
    orderUrl: string;
    supplierName: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【订单】请提交合同 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '恭喜，您已中标',
      intro: `${data.supplierName}，您好！采购方已选定您为「${data.inquiryTitle}」的成交供应商，请尽快提交合同文件。`,
      rows: [
        ['订单号', data.orderNo],
        ['项目', data.projectName],
        ['询价项', data.inquiryTitle],
        ['订单金额', `${data.currency} ${data.amount}`],
      ],
      note: '请在订单详情页上传合同文件，采购方审核后将回传修订版。',
      actionText: '查看订单',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderContractSubmitted(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    supplierName: string;
    note?: string | null;
    orderUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【合同】${data.supplierName} 已提交合同 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '供应商提交了合同',
      intro: `${data.supplierName} 已提交订单 ${data.orderNo} 的合同文件，请及时审核。`,
      rows: [
        ['订单号', data.orderNo],
        ['供应商', data.supplierName],
        ...(data.note ? [['供应商备注', data.note] as [string, string]] : []),
      ],
      actionText: '审核合同',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderContractReturned(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    note?: string | null;
    orderUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【合同】修订版合同已回传 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '采购方回传了修订版合同',
      intro: `订单 ${data.orderNo} 的修订版合同已回传，请下载查看并完成线下签署。`,
      rows: [
        ['订单号', data.orderNo],
        ...(data.note ? [['内部备注', data.note] as [string, string]] : []),
      ],
      actionText: '查看订单',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderAcceptanceUploaded(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    supplierName: string;
    orderUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【验收单】${data.supplierName} 已上传 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '供应商上传了验收单',
      intro: `${data.supplierName} 已上传订单 ${data.orderNo} 的验收单，请查看并完成签署。`,
      rows: [
        ['订单号', data.orderNo],
        ['供应商', data.supplierName],
      ],
      actionText: '查看并签署验收单',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderAcceptanceSigned(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    orderUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【验收单】已签署 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '验收单已签署',
      intro: `订单 ${data.orderNo} 的验收单已由采购方签署，您可在订单详情中下载查看。`,
      rows: [['订单号', data.orderNo]],
      actionText: '查看订单',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}

export function renderInvoiceSubmitted(
  brand: MailBrand,
  data: ProjectContact & {
    orderNo: string;
    supplierName: string;
    invoiceNo: string;
    amount: string;
    currency: string;
    note?: string | null;
    orderUrl: string;
  },
): { html: string; text: string; subject: string } {
  return {
    subject: `【发票/请款】${data.supplierName} 已提交 - ${data.orderNo}`,
    ...renderLayout({
      brand,
      title: '供应商提交了发票与请款材料',
      intro: `${data.supplierName} 已提交订单 ${data.orderNo} 的发票与请款材料。`,
      rows: [
        ['订单号', data.orderNo],
        ['供应商', data.supplierName],
        ['发票号', data.invoiceNo],
        ['金额', `${data.currency} ${data.amount}`],
        ...(data.note ? [['备注', data.note] as [string, string]] : []),
      ],
      actionText: '查看订单',
      actionUrl: data.orderUrl,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
  };
}
