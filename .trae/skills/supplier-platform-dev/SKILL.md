---
name: supplier-platform-dev
description: 供应商微平台的开发速查：运行命令、双账号认证、询价→报价→选标→订单→合同→验收→发票状态机、数据模型与页面路由、常见陷阱。开始修改本项目代码前使用。
---

# 供应商微平台开发速查

## 仓库结构

- `supplier-microplatform-nestjs/`：NestJS 12 ESM + Prisma 7 + Better Auth 1.7，端口 3100，前缀 `/api`。
- `supplier-microplatform-nextjs/`：Next.js 16 App Router + React 19 + HeroUI v3 + Tailwind 4，端口 3000，`/api/*` 代理到后端。
- `docs/`：架构、数据模型、API、页面、ADR；`requirements.md` 是需求与验收的单一事实来源。

## 本地启动

```bash
docker compose -f dev-containers/docker-compose.yml up -d   # PostgreSQL :5433 + Mailpit :1025/:8025
cd supplier-microplatform-nestjs && pnpm install && pnpm db:deploy && pnpm db:seed && pnpm start:dev
cd supplier-microplatform-nextjs && pnpm install && pnpm dev
```

- 管理员：`admin` / `Admin12345`（`SEED_ADMIN_*` 可覆盖）。
- 邮件收件箱：http://localhost:8025。
- 提交前：后端 `pnpm lint && pnpm test && pnpm build`；前端 `pnpm lint && pnpm exec vitest run && pnpm build`。

## 状态机

```
询价：DRAFT → OPEN → CLOSED → AWARDED，可 CANCELLED；CLOSED 可重新开放
订单：PENDING_CONTRACT → IN_PROGRESS → COMPLETED，可 CANCELLED
合同：PENDING_SUBMISSION → SUBMITTED → RETURNED → COMPLETED
验收：UPLOADED → SIGNED（可选，不阻塞订单完成）
项目：ACTIVE → ARCHIVED（只读）
```

关键不变式：

- 一个询价项最多一个订单；选标在事务内创建订单与合同。
- 报价仅 `OPEN` 且未过截止可提交；修改时 `version+1`。
- 订单完成后拒绝新合同/验收/发票提交；已上传验收单仍可签署。
- 发票本期仅记录，不校验金额上限与重复发票号。

## 认证与权限

- 内部 `/api/auth/internal/*`，供应商 `/api/auth/supplier/*`，表与会话完全隔离。
- 公开注册关闭；登录/找回/重置有 60 秒 10 次限流。
- 停用账号不能建立会话；`mustChangePassword=true` 只放行改密。
- 写操作校验项目创建者/管理员；供应商只能访问自己企业且被邀请的数据。

## 数据模型速查

- 账号：`internal_user`、`supplier_user`（`supplierId` 绑定供应商）。
- 业务：`supplier`、`supplier_visibility_user`、`supplier_rating`、`project`、`inquiry`、`inquiry_supplier`、`quote`、`order`、`contract`、`contract_file`、`acceptance_certificate`、`invoice`。
- 支撑：`attachment`、`audit_log`、`mail_log`、`system_setting`。
- `relationMode = "prisma"`，无数据库外键；唯一索引兜底重复（如 `order.inquiryId`）。

## 页面路由

- 内部：`/dashboard`、`/projects`、`/suppliers`、`/orders/[orderId]`、`/admin/*`、`/account`。
- 供应商：`/supplier/dashboard`、`/supplier/inquiries`、`/supplier/orders`、`/supplier/quote-history`、`/supplier/account`。
- 动态页面：Server Page + `Suspense` + `params.then(...)`；portal layout 保留 `export const instant = false;`。

## 常见陷阱

- 后端相对导入必须带 `.js`；不要使用 `__dirname`。
- 新账号 `mustChangePassword=true`，测试时先走改密流程。
- 修改 Prisma Schema 后必须 `pnpm db:generate`。
- 附件下载需先取签名 URL，不能直接拼下载地址。
- 前端测试命令是 `pnpm exec vitest run`（`pnpm test` 在 watch 模式）。
