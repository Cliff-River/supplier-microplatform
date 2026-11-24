# 供应商微平台 · 前端

Next.js 16 App Router + React 19 + HeroUI v3 + Tailwind CSS 4，提供内部端与供应商端全部页面。

- 默认地址：http://localhost:3000
- 接口代理：`/api/:path*` → NestJS `http://localhost:3100`
- 完整页面说明：[../docs/pages.md](../docs/pages.md)
- 架构与权限：[../docs/architecture.md](../docs/architecture.md)

## 快速开始

先启动后端（见 [后端 README](../supplier-microplatform-nestjs/README.md)），然后：

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

入口：

| 端 | 地址 |
| --- | --- |
| 内部端 | http://localhost:3000/login |
| 供应商端 | http://localhost:3000/supplier/login |

## 页面路由

### 公共

| 路由 | 说明 |
| --- | --- |
| `/login` | 内部登录 |
| `/forgot-password` / `/reset-password` | 内部找回/重置密码 |
| `/change-password` | 内部首次登录强制改密 |
| `/supplier/login` | 供应商登录 |
| `/supplier/forgot-password` / `/supplier/reset-password` | 供应商找回/重置 |
| `/supplier/change-password` | 供应商强制改密 |
| `/forbidden` | 403 |
| `not-found` | 全局 404 |

### 内部端

| 路由 | 说明 |
| --- | --- |
| `/dashboard` | 工作台 |
| `/projects` | 项目列表 |
| `/projects/new` | 新建项目 |
| `/projects/[projectId]` | 项目详情 |
| `/projects/[projectId]/edit` | 编辑项目 |
| `/projects/[projectId]/inquiries/new` | 新增询价项 |
| `/projects/[projectId]/inquiries/[inquiryId]` | 询价详情与报价对比（排序/高亮/Excel 导出/选标） |
| `/suppliers` | 供应商列表 |
| `/suppliers/new` | 新建供应商 |
| `/suppliers/[supplierId]` | 供应商详情（账号/可见范围/评级） |
| `/suppliers/[supplierId]/edit` | 编辑供应商 |
| `/orders/[orderId]` | 订单详情（合同/验收/发票/完成） |
| `/admin/users` | 内部用户管理（管理员） |
| `/admin/settings` | 系统设置（管理员） |
| `/admin/mail-logs` | 邮件日志（管理员） |
| `/account` | 个人中心 |

### 供应商端

| 路由 | 说明 |
| --- | --- |
| `/supplier/dashboard` | 工作台 |
| `/supplier/inquiries` | 开放中的受邀询价 |
| `/supplier/inquiries/[inquiryId]` | 询价详情与报价 |
| `/supplier/orders` | 我的订单 |
| `/supplier/orders/[orderId]` | 合同/验收/发票提交与记录 |
| `/supplier/quote-history` | 我的报价历史（只读） |
| `/supplier/account` | 账号与所属企业 |

## 目录结构

```
app/
├── (auth)/                 # 内部登录/找回/重置/改密
├── (internal)/             # 内部端（侧边栏布局）
├── supplier/               # 供应商端（顶部导航布局）
│   └── (portal)/
├── error.tsx               # 全局错误
├── not-found.tsx           # 全局 404
├── forbidden/              # 403
└── providers.tsx           # QueryClient 等 Provider
components/
├── layout/                 # InternalShell、SupplierShell
├── auth/                   # 登录/找回/重置/改密表单
├── ui/                     # PageHeader、Modal、StatusChip、form
├── attachments/            # 附件上传与签名下载
├── suppliers/              # 供应商表单
└── admin/                  # 用户表单弹窗
lib/
├── api-client.ts           # 统一请求、错误处理
├── auth.ts                 # Better Auth 客户端
├── download.ts             # 签名下载
└── format.ts               # 金额/日期/数字格式化
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://localhost:3100` | Next rewrite 的后端目标（仅服务端使用） |

如需自定义，在项目根创建 `.env.local`。

## 代理配置

`next.config.ts`：

```ts
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3100";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};
```

浏览器只访问 3000，Cookie 同源，无需 CORS。

## 路由与状态约定

- 内部端与供应商端 portal layout 设置 `export const instant = false;`（依赖登录态与路径）。
- 动态路由：Server Page + `<Suspense>` + `{params.then(...)}`；不要在 Client Component 中直接 `useParams()` 而不包 Suspense。
- 未登录跳转对应登录页；`mustChangePassword=true` 强制进入改密页；会话失配跳 `/forbidden`。
- 已归档项目只读，写操作入口隐藏且服务端拒绝。

## 测试与检查

```bash
pnpm lint               # eslint
pnpm exec vitest run    # 单元测试（jsdom + Testing Library）
pnpm build              # 生产构建
```

单元测试位于 `lib/*.spec.ts`、`components/**/*.spec.tsx`，覆盖格式化、状态标签等纯展示逻辑。
