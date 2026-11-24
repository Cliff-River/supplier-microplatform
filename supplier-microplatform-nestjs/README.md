# 供应商微平台 · 后端

NestJS 12（ESM）API 服务，提供 Better Auth 双实例认证、业务 REST 接口、邮件通知、本地附件存储与审计日志。

- 全局前缀：`/api`，默认端口 `3100`
- 数据库：PostgreSQL 16（本地 `127.0.0.1:5433`）
- 完整接口清单：[../docs/api.md](../docs/api.md)
- 架构与状态机：[../docs/architecture.md](../docs/architecture.md)
- 数据模型：[../docs/data-model.md](../docs/data-model.md)

## 快速开始

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:deploy      # 生产/CI；开发创建新迁移用 pnpm db:migrate
pnpm db:seed
pnpm start:dev      # http://localhost:3100
```

健康检查：`GET http://localhost:3100/api/health`

## 模块说明

| 模块 | 目录 | 职责 |
| --- | --- | --- |
| 认证 | `src/auth/` | Better Auth 内部/供应商双实例、账号创建/停用/重置 |
| 当前用户 | `src/me.controller.ts`、`src/supplier-me.controller.ts` | 内部/供应商个人资料 |
| 用户管理 | `src/modules/users/` | 管理员创建内部用户、角色、状态、重置密码 |
| 供应商 | `src/modules/suppliers/` | 供应商档案、账号、可见范围、评级 |
| 项目 | `src/modules/projects/` | 项目 CRUD、归档、默认询价项 |
| 询价 | `src/modules/inquiries/` | 询价项状态流转、邀请、发送/关闭/重开/作废、选标、到期自动关闭 |
| 报价 | `src/modules/quotes/` | 供应商报价提交/修改、内部对比、Excel 导出 |
| 订单 | `src/modules/orders/` | 订单、合同、验收单、发票、完成/取消 |
| 工作台 | `src/modules/dashboard/` | 内部/供应商工作台数据 |
| 管理 | `src/modules/admin/` | 审计日志、邮件日志与重试、系统设置 |
| 邮件 | `src/mail/` | Nodemailer 发送、模板、MailLog |
| 存储 | `src/storage/` | 本地文件、签名下载、上传校验 |
| 公共 | `src/common/` | 守卫、装饰器、异常、响应包络、审计、工具 |
| 配置 | `src/config/` | Zod 环境变量校验 |

## 环境变量

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `DATABASE_URL` | `postgresql://postgres:prisma@localhost:5433/supplier_microplatform` | 数据库连接 |
| `PORT` | `3100` | 服务端口 |
| `APP_URL` | `http://localhost:3000` | 前端地址，用于邮件链接 |
| `INTERNAL_AUTH_SECRET` | 32+ 随机字符 | 内部 Better Auth 密钥 |
| `SUPPLIER_AUTH_SECRET` | 32+ 随机字符 | 供应商 Better Auth 密钥 |
| `FILE_SIGNING_SECRET` | 32+ 随机字符 | 附件下载签名密钥 |
| `MAIL_HOST` | `127.0.0.1` | SMTP 主机（本地 Mailpit） |
| `MAIL_PORT` | `1025` | SMTP 端口 |
| `MAIL_SECURE` | `false` | `true` 时使用 TLS |
| `MAIL_USER` / `MAIL_PASS` | 空 | 本地留空；生产必填 |
| `MAIL_FROM` | `供应商微平台 <no-reply@local.test>` | 统一发件人 |
| `STORAGE_DIR` | `./storage/uploads` | 附件目录 |
| `MAX_UPLOAD_MB` | `20` | 单文件上限 |
| `SEED_ADMIN_EMAIL` | `admin@local.test` | 初始化管理员邮箱 |
| `SEED_ADMIN_USERNAME` | `admin` | 初始化管理员用户名 |
| `SEED_ADMIN_PASSWORD` | `Admin12345` | 初始化管理员密码 |
| `TZ` | `Asia/Shanghai` | 时区 |

环境变量由 `src/config/env.ts` 使用 Zod 校验，缺失或格式错误会拒绝启动。

## Prisma 工作流

```bash
pnpm db:generate   # 生成 Client 到 src/generated/prisma
pnpm db:ensure     # 确保数据库存在
pnpm db:migrate    # 开发：创建并应用迁移
pnpm db:deploy     # 生产/CI：应用已有迁移
pnpm db:seed       # 初始化管理员与基础设置
pnpm db:studio     # 可视化查看
```

- Schema：`prisma/schema.prisma`，`relationMode = "prisma"`（不建数据库外键）。
- 迁移：`prisma/migrations/`。
- 种子：`prisma/seed.ts`，使用 `SEED_ADMIN_*`。
- 修改 Schema 后必须重新生成 Client；提交迁移文件后再部署。

## 邮件配置

- 本地：`MAIL_HOST=127.0.0.1`、`MAIL_PORT=1025`，指向 Mailpit；Web UI http://localhost:8025。
- 生产：配置真实 SMTP（如 `smtp.example.com` / `465` / `true`）与账号密码。
- 每次发信写入 `mail_log`；失败不阻塞业务，可在管理员邮件日志页重试。
- 测试发信：管理员 `POST /api/admin/mail/test` 或页面 `/admin/settings`。

## 存储配置

- 附件写入 `STORAGE_DIR`，元数据存 `attachment` 表。
- 上传先创建 `TEMP` 附件，提交业务时绑定 `scope/scopeId`。
- 下载流程：`POST /api/files/:id/access-token` → `GET /api/files/:id/download?...`；签名有效期 5 分钟。
- 多实例部署时应将 `StorageService` 切换为对象存储（S3/OSS）。

## 认证与安全

- 内部：`/api/auth/internal/*`；供应商：`/api/auth/supplier/*`。
- 公开注册关闭，`/sign-up*` 返回 404。
- 登录/找回/重置按 `IP + 路径` 限流（60 秒 10 次），超限 429。
- 停用账号无法建立会话；`mustChangePassword=true` 仅放行改密接口。
- 关键操作写 `audit_log`。

## 测试与检查

```bash
pnpm lint     # oxlint --type-aware
pnpm test     # vitest run（单元测试）
pnpm build    # nest build
```

单元测试位于 `src/**/*.spec.ts`，覆盖编号工具、守卫与权限校验等。
