# 前端页面说明

> 对应需求：[前端页面设计](../requirements.md#8-前端页面设计)。
> 技术：Next.js 16 App Router、React 19、HeroUI v3、Tailwind CSS 4、TanStack Query。

## 1. 目录结构

```
app/
├── (auth)/                    # 内部登录/找回/重置/改密
├── (internal)/                # 内部端（侧边栏布局）
│   ├── dashboard/
│   ├── projects/
│   ├── suppliers/
│   ├── orders/[orderId]/
│   ├── admin/{users,settings,mail-logs}/
│   └── account/
├── supplier/
│   ├── login|forgot-password|reset-password|change-password/
│   └── (portal)/              # 供应商端（顶部导航布局）
│       ├── dashboard/
│       ├── inquiries/[inquiryId]/
│       ├── orders/[orderId]/
│       ├── quote-history/
│       └── account/
├── page.tsx                   # 根路由跳转登录
├── error.tsx                  # 全局错误边界
├── not-found.tsx              # 全局 404
└── forbidden/page.tsx         # 403

components/
├── layout/                    # InternalShell、SupplierShell
├── ui/                        # PageHeader、Modal、StatusChip、form
├── auth/                      # 登录/找回/重置/改密表单
├── attachments/               # 附件上传与下载
├── suppliers/                 # 供应商表单
└── admin/                     # 用户表单弹窗

lib/
├── api-client.ts              # 统一请求与错误处理
├── auth.ts                    # Better Auth 客户端封装
├── download.ts                # 签名下载
└── format.ts                  # 金额/日期/数字格式化
```

## 2. 页面清单

### 2.1 公共页面

| 编号 | 路由 | 文件 | 说明 |
| --- | --- | --- | --- |
| P-01 | `/login` | `app/(auth)/login/page.tsx` | 内部登录，支持用户名或邮箱 |
| P-02 | `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | 发送重置邮件 |
| P-03 | `/reset-password` | `app/(auth)/reset-password/page.tsx` | 通过邮件 token 重置 |
| P-04 | `/change-password` | `app/(auth)/change-password/page.tsx` | 内部首次登录强制改密 |
| P-05 | `/supplier/login` | `app/supplier/login/page.tsx` | 供应商登录 |
| P-06 | `/supplier/forgot-password` | `app/supplier/forgot-password/page.tsx` | 供应商找回密码 |
| P-07 | `/supplier/reset-password` | `app/supplier/reset-password/page.tsx` | 供应商重置密码 |
| P-08 | `/supplier/change-password` | `app/supplier/change-password/page.tsx` | 供应商强制改密 |
| P-09 | `/forbidden` | `app/forbidden/page.tsx` | 403 提示与会话失配引导 |
| P-10 | 任意未知路由 | `app/not-found.tsx` | 404，提供返回工作台入口 |

### 2.2 内部端

| 编号 | 路由 | 文件 | 说明 |
| --- | --- | --- | --- |
| I-01 | `/dashboard` | `app/(internal)/dashboard/page.tsx` | 工作台：KPI、待办、最近项目、即将截止询价 |
| I-02 | `/projects` | `app/(internal)/projects/page.tsx` | 项目列表与筛选 |
| I-03 | `/projects/new` | `app/(internal)/projects/new/page.tsx` | 新建项目，可同时创建默认询价项 |
| I-04 | `/projects/[projectId]` | `app/(internal)/projects/[projectId]/page.tsx` | 项目详情、询价项、订单摘要、归档 |
| I-05 | `/projects/[projectId]/edit` | `…/edit/page.tsx` | 编辑项目 |
| I-06 | `/projects/[projectId]/inquiries/new` | `…/inquiries/new/page.tsx` | 新增询价项与邀请供应商 |
| I-07 | `/projects/[projectId]/inquiries/[inquiryId]` | `…/inquiries/[inquiryId]/page.tsx` | 询价详情、报价对比、排序、高亮、Excel 导出、选标 |
| I-08 | `/suppliers` | `app/(internal)/suppliers/page.tsx` | 供应商列表（关键词/评级/可见范围/状态） |
| I-09 | `/suppliers/new` | `app/(internal)/suppliers/new/page.tsx` | 新建供应商与首个账号 |
| I-10 | `/suppliers/[supplierId]` | `app/(internal)/suppliers/[supplierId]/page.tsx` | 详情、账号、可见范围、评级 |
| I-11 | `/suppliers/[supplierId]/edit` | `…/edit/page.tsx` | 编辑供应商 |
| I-12 | `/orders/[orderId]` | `app/(internal)/orders/[orderId]/page.tsx` | 订单、合同回传/签署完成、验收签署、发票查看、完成/取消 |
| I-13 | `/admin/users` | `app/(internal)/admin/users/page.tsx` | 内部用户管理（管理员） |
| I-14 | `/admin/settings` | `app/(internal)/admin/settings/page.tsx` | 平台设置、测试发信、邮件日志、审计日志（管理员） |
| I-15 | `/admin/mail-logs` | `app/(internal)/admin/mail-logs/page.tsx` | 邮件日志与失败重试（管理员） |
| I-16 | `/account` | `app/(internal)/account/page.tsx` | 个人中心与改密入口 |

### 2.3 供应商端

| 编号 | 路由 | 文件 | 说明 |
| --- | --- | --- | --- |
| S-01 | `/supplier/dashboard` | `app/supplier/(portal)/dashboard/page.tsx` | 待报价、待提交合同、进行中订单 |
| S-02 | `/supplier/inquiries` | `app/supplier/(portal)/inquiries/page.tsx` | 仅展示被邀请且开放中的询价 |
| S-03 | `/supplier/inquiries/[inquiryId]` | `…/inquiries/[inquiryId]/page.tsx` | 询价详情、附件、提交/修改报价 |
| S-04 | `/supplier/orders` | `app/supplier/(portal)/orders/page.tsx` | 自己的订单列表 |
| S-05 | `/supplier/orders/[orderId]` | `…/orders/[orderId]/page.tsx` | 合同、验收单、发票提交与记录 |
| S-06 | `/supplier/quote-history` | `app/supplier/(portal)/quote-history/page.tsx` | 我的报价历史（只读） |
| S-07 | `/supplier/account` | `app/supplier/(portal)/account/page.tsx` | 账号资料与所属企业 |

## 3. 路由守卫与跳转

| 场景 | 行为 |
| --- | --- |
| 未登录访问内部页面 | 跳转 `/login` |
| 未登录访问供应商页面 | 跳转 `/supplier/login` |
| 内部会话访问 `/supplier/*` | 跳转 `/forbidden` |
| 供应商会话访问内部页面 | 跳转 `/forbidden` |
| 非管理员访问 `/admin/*` | 跳转 `/forbidden` |
| `mustChangePassword=true` | 强制跳转 `/change-password` 或 `/supplier/change-password` |
| 访问不存在的资源 | 展示 404，不泄露资源是否存在 |
| 访问已归档项目 | 可查看，写操作隐藏且服务端拒绝 |

实现要点：

- 内部与供应商的 portal layout 均设置 `export const instant = false;`，因为依赖登录态与当前路径。
- 动态路由页面使用 Server Page + `Suspense` + `{params.then(...)}`，避免 `useParams()` 在 Client Component 中脱离 Suspense。
- 登录成功后回跳 `redirect` 参数，缺省进入对应工作台。

## 4. 关键交互

### 4.1 询价详情与报价对比（I-07）

- 对比表支持按**总价 / 交期 / 评级**升序或降序排序；交期为空的报价排在最后。
- 最低总价、最短交期行高亮。
- 顶部操作：关闭/重新开放/作废/重发邮件；关闭后可选择一个供应商选标，选标即生成订单与合同。
- 支持导出 Excel（`GET /api/inquiries/:id/quotes/export?format=xlsx`）。

### 4.2 合同与验收（I-12 / S-05）

- 供应商上传合同后，合同状态 `SUBMITTED`；内部可上传修订版回传（`RETURNED`）。
- 内部可标记线下签署完成（`COMPLETED`，可选）。
- 验收单为可选：供应商上传后内部可签署；订单完成后仍可签署已上传验收单。
- 订单完成后，供应商端合同/验收/发票提交入口禁用。

### 4.3 附件

- 所有上传先调用 `POST /api/files`，提交业务时携带附件 ID。
- 下载先请求 `POST /api/files/:id/access-token`，再使用签名 URL 下载（`lib/download.ts`）。

## 5. 全局体验规范

- HeroUI v3 复合组件 + Tailwind 工具类；页面背景 `zinc-50`，卡片 `rounded-2xl` 白底细边框。
- 金额与数量使用 `tabular-nums`；日期按 `Asia/Shanghai` 展示。
- 加载、空、错误、无权限四种状态均有明确展示。
- 表单使用 `react-hook-form` + `zod` 校验；提交按钮防重；危险操作二次确认。
- 响应式：375px、768px、1440px 三档布局；表格在窄屏允许横向滚动，页面主体不出现横向滚动。
