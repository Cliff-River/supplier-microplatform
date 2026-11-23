# 供应商微平台 —— 需求与设计开发方案

> 文档版本：v1.2（2026-11-23）
> 适用项目：`supplier-microplatform-nestjs`（后端）、`supplier-microplatform-nextjs`（前端）
> 说明：本文在原始需求基础上补齐总体架构、账号权限、状态机、数据模型、API、邮件与**逐页设计方案**。文中标注「设计假设」的条目为当前方案约定，实施前可调整。
> v1.1 变更：采纳评审意见——增加可选验收单、供应商历史报价、报价对比增强；明确订单完成人；发票审核移出本期；账号首次登录强制改密；附件签名下载；新增审计日志与 ADR。
> v1.2 变更：采纳 `docker-compose` 本地开发环境（PostgreSQL + Mailpit），新增 2.6 节与 ADR-012。

## 目录

1. [项目概述](#1-项目概述)
2. [总体架构](#2-总体架构)
3. [账号、角色与权限](#3-账号角色与权限)
4. [核心业务流程与状态机](#4-核心业务流程与状态机)
5. [数据模型设计](#5-数据模型设计)
6. [API 设计](#6-api-设计)
7. [邮件通知设计](#7-邮件通知设计)
8. [前端页面设计](#8-前端页面设计)
9. [非功能设计](#9-非功能设计)
10. [测试方案](#10-测试方案)
11. [开发计划](#11-开发计划)
12. [验收标准](#12-验收标准)
13. [工程规范与文档交付](#13-工程规范与文档交付)
14. [设计假设与待确认事项](#14-设计假设与待确认事项)
15. [架构决策记录（ADR）](#15-架构决策记录adr)

---

## 1. 项目概述

### 1.1 背景与目标

供应商微平台用于连接内部采购/业务人员与外部供应商，覆盖「供应商档案 → 询价 → 报价 → 选标下单 → 合同往来 → 发票请款」的完整链路，替代分散的邮件与线下表格协作。本期覆盖到「发票/请款提交与查看」为止；**发票校验 → 对账 → 支付证明单（付款申请书）生成属于后续演进，不在本次实施范围内**（详见 [1.6 后续演进](#16-后续演进不在本期实施范围)）。

核心目标：

1. **流程线上化**：询价、报价、合同、发票全部在平台留痕，状态可追踪。
2. **权限清晰**：内部用户与供应商两套账号体系，数据严格隔离。
3. **邮件协同**：关键节点自动发送邮件，减少人工通知与文件转发。
4. **可维护**：前后端分离、模块边界清晰，便于后续扩展（多组织、在线签署、对接 ERP 等）。

### 1.2 角色定义

| 角色 | 说明 | 主要能力 |
| --- | --- | --- |
| 内部管理员 `ADMIN` | 平台管理员 | 内部用户管理、供应商与账号管理、查看与操作全部项目、系统设置 |
| 内部普通用户 `MEMBER` | 采购/业务人员 | 创建项目、创建供应商及供应商账号、管理自己创建的数据、查看共享项目 |
| 供应商业务员 `SUPPLIER` | 供应商侧账号（一个供应商可有多个） | 查看被邀请且开放中的询价、提交/修改报价、查看自己的历史报价、提交合同、提交验收单、提交发票与请款 |

### 1.3 关键术语

| 术语 | 含义 |
| --- | --- |
| 项目 Project | 一次采购/业务需求的容器，包含若干询价项 |
| 询价项 Inquiry | 项目下的一个具体询价标的；独立设置参与供应商与开放期限 |
| 受邀供应商 | 某个询价项指定可参与报价的供应商 |
| 报价 Quote | 供应商针对一个询价项提交的一次报价（截止前可修改，保留版本号） |
| 选标 Award | 内部用户在询价关闭后选定一个供应商，生成订单 |
| 订单 Order | 选标后生成的履约单元，一个询价项对应一个订单 |
| 合同 Contract | 订单下的合同往来记录（供应商提交 → 内部回传修订版） |
| 验收单 Acceptance | 订单履约的**可选**材料；供应商上传，内部签署；不阻塞订单完成 |
| 发票/请款 Invoice | 供应商针对订单提交的发票与请款材料，可多次提交 |
| 可见范围 Visibility | 供应商对内部用户的可见性：全员或指定用户 |
| 评级 Rating | 内部用户从报价质量、响应速度、服务态度三个维度对供应商打分 |

### 1.4 范围与非目标

**MVP 范围**

- 双账号体系、登录、邮箱找回密码、内部用户管理。
- 供应商档案、供应商账号、可见范围、评级。
- 项目与多询价项、邀请供应商、发送询价邮件、供应商报价、报价对比（排序/差异高亮/Excel 导出）、选标。
- 订单生成、合同提交与回传、可选验收单上传与签署、发票与请款提交。
- 供应商「我的报价历史」只读查看（含已关闭/已选标的询价）。
- 邮件通知与邮件日志、附件上传下载（短期签名 URL）。
- 内部端与供应商端完整页面、响应式布局、单元测试。

**暂不在 MVP 范围**

- 供应商自助注册、在线电子签章。
- **发票审核/驳回、发票校验、财务对账、支付证明单（付款申请书）生成**：本期仅保留发票/请款提交与查看记录，以上能力见 [1.6 后续演进](#16-后续演进不在本期实施范围)。
- 多币种汇率换算（字段保留币种，默认 CNY）。
- 站内即时消息、移动 App、复杂审批流。
- 供应商侧查看评级分数（内部可见即可）。

### 1.5 关键设计决策

| 决策点 | 方案 | 理由 |
| --- | --- | --- |
| 账号体系 | Better Auth 双实例：内部 `/api/auth/internal`、供应商 `/api/auth/supplier` | 物理隔离两套账号与会话，符合「两套账号体系」要求；互不影响 |
| 登录标识 | 用户名或邮箱 + 密码；邮箱必填 | 满足需求；输入含 `@` 走邮箱登录，否则走用户名登录 |
| 认证落点 | Better Auth 挂载在 NestJS（Express Adapter） | API 与鉴权同进程，守卫可直接校验会话；前端经 Next 代理同源访问 |
| 可见范围 | 供应商级 `ALL / SPECIFIED`；创建者与管理员始终可见 | 简单可解释；不引入项目级复杂授权 |
| 报价修改 | 截止前允许修改，版本号递增，每次提交都通知内部 | 符合实际询价场景，避免供应商因笔误失去机会 |
| 订单与合同 | 订单状态与合同状态分离 | 合同有独立的多轮往来，订单只关心履约阶段 |
| 数据库外键 | Prisma `relationMode = "prisma"`，不创建真实数据库外键 | 满足工程约定；由应用层保证一致性 |
| 附件存储 | 本地磁盘 + `StorageService` 抽象 | 零外部依赖启动；后续可平滑切换 S3/OSS |
| 邮件发送 | 同步发送 + 邮件日志 + 失败可重发 | 结构简单；关键通知可追踪 |
| 订单完成 | 由项目创建者或管理员手动标记 | 业务确认后收口，不依赖供应商操作 |
| 验收单 | 可选流程：供应商上传 → 内部签署；不阻塞订单完成 | 满足实际验收需要，又避免所有订单被强制卡住 |
| 发票与付款 | 本期仅提交与查看；发票校验、对账、支付证明单生成后续实施 | 控制范围，同时保留清晰演进路径（见 1.6） |
| 供应商历史报价 | 开放中询价 + 「我的报价历史」只读页 | 关闭后仍可回看自己的报价，改善体验 |
| 账号开通 | 一次性初始密码 + 首次登录强制改密 | 避免长期使用邮件中的初始密码 |
| 附件下载 | 短期签名 URL + 会话与权限校验 | 降低附件 ID 被枚举/盗链的风险 |
| 审计日志 | `audit_log` 记录关键操作 | 选标、合同回传、订单完成、账号停用可追溯 |
| 本地开发环境 | `docker-compose` 启动 PostgreSQL 16 + Mailpit | 环境一致、一键启动；邮件只进本地收件箱，可验证模板与附件 |
| 文档拆分 | MVP 开发完成后拆分 `docs/*` | 当前先保证方案完整，避免过早拆散上下文 |
| 内部项目可见性 | 内部用户共享查看全部项目；编辑/操作归创建者与管理员（设计假设） | 避免信息孤岛，同时保护关键操作 |

### 1.6 后续演进（不在本期实施范围）

本期（MVP）链路到「发票/请款提交与内部查看」为止。完整财务闭环规划如下，**以下能力本期均不实施**，仅作为架构演进方向记录，便于后续迭代与 AI Agent 明确边界：

| 阶段 | 能力 | 本期 | 说明 |
| --- | --- | --- | --- |
| 1 | 发票提交 | 实施 | 供应商上传发票与请款书，可多次提交；内部只读查看 |
| 2 | 发票校验 | 不实施 | 发票真伪查验、抬头/税号/金额/税率一致性校验、重复发票检测 |
| 3 | 对账 | 不实施 | 订单/合同/验收单/发票金额核对、差异标记与处理、对账单生成与导出 |
| 4 | 支付证明单（付款申请书）生成 | 不实施 | 基于对账结果生成付款申请书、对接审批流、回写支付状态 |

约束说明：

- 本期数据模型不引入发票校验、对账、付款相关表与状态；`invoice` 仅作为提交记录（见 5.4）。
- **平台不处理实际资金支付**：支付证明单（付款申请书）仅作为财务付款依据生成，实际付款沿用线下对公转账/财务系统；本期与后续均不接入在线支付网关。
- 本期不提供上述能力的 API 与页面；第 6、8 章的接口与页面清单即为本期完整范围。
- 后续实施作为独立阶段，需新增状态机、数据模型、权限矩阵与页面，不影响本期已交付流程。

---

## 2. 总体架构

### 2.1 架构图

```mermaid
flowchart LR
    subgraph Browser["浏览器"]
        IU["内部用户"]
        SU["供应商"]
    end

    FE["Next.js 16 前端<br/>App Router + HeroUI v3 + Tailwind 4"]
    BE["NestJS 12 API<br/>REST + 守卫 + Zod 校验"]
    AUTH["Better Auth<br/>internal / supplier 双实例"]
    DB[("PostgreSQL<br/>supplier_microplatform")]
    FS[("本地文件存储<br/>storage/uploads")]
    MAIL["SMTP 邮件服务"]

    IU --> FE
    SU --> FE
    FE -- "/api/* 反向代理" --> BE
    BE --- AUTH
    BE --> DB
    BE --> FS
    BE --> MAIL
```

### 2.2 技术栈（以当前脚手架为准）

| 层 | 技术 | 版本/说明 |
| --- | --- | --- |
| 前端框架 | Next.js App Router | 16.4.6，React 19.3.0 |
| UI | HeroUI v3（`@heroui/react` + `@heroui/styles`） | 3.2.x，复合组件写法（如 `Card.Header`） |
| 样式 | Tailwind CSS | 4.3.3 |
| 表单 | `react-hook-form` + `zod` | 新增依赖 |
| 服务端状态 | `@tanstack/react-query` | 新增依赖，负责缓存、轮询、提交状态 |
| 前端测试 | Vitest + Testing Library + jsdom | 已配置 |
| 后端框架 | NestJS 12（ESM） | `@nestjs/platform-express`，默认端口 3100 |
| 校验 | Zod + `StandardSchemaValidationPipe` | Nest 12 推荐方式，避免 class-validator 装饰器 |
| ORM | Prisma | 新增依赖；`relationMode = "prisma"` |
| 数据库 | PostgreSQL | `postgresql://postgres:prisma@localhost:5432/supplier_microplatform` |
| 认证 | Better Auth | `emailAndPassword` + `username` 插件，双实例 |
| 邮件 | `@nestjs/mail`（Nodemailer） | 若版本不可用则退回 `nodemailer` |
| 定时任务 | `@nestjs/schedule` | 询价到期自动关闭、报价截止校验 |
| 包管理 | pnpm | 两个子项目各自维护 `pnpm-lock.yaml` |

> 注意：NestJS 12 与 Next.js 16 均与常见版本存在破坏性差异，编码前先查阅各自 `AGENTS.md` 指向的官方文档（`node_modules/next/dist/docs/`、Nest 官方文档）。

### 2.3 请求链路与同源策略

1. 浏览器只访问 Next.js（开发环境 `http://localhost:3000`）。
2. Next.js 通过 `next.config.ts` 的 `rewrites` 将 `/api/:path*` 代理到 NestJS（`http://localhost:3100/api/:path*`）。
3. 浏览器与 Nest 之间保持同源，Better Auth 的 HttpOnly Cookie 可直接生效，避免开发期 CORS 与 Cookie 跨域问题。
4. 页面数据请求分为两类：
   - **服务端组件**：仅用于布局、静态壳与 SEO 元信息；
   - **客户端组件 + TanStack Query**：登录态下的列表、详情、表单与轮询，统一通过 `lib/api-client.ts` 发请求。
5. 所有接口默认要求会话；公开接口仅登录、找回密码、重置密码。

### 2.4 代码结构规划

**后端 `supplier-microplatform-nestjs/src`**

```
src/
├── main.ts                     # 全局前缀 /api、Cookie 解析、Better Auth 挂载、异常过滤器
├── app.module.ts
├── config/                     # 环境变量校验（Zod）、配置命名空间
├── common/
│   ├── guards/                 # InternalAuthGuard / SupplierAuthGuard
│   ├── decorators/             # @CurrentUser() / @Roles()
│   ├── filters/                # 统一异常响应
│   ├── interceptors/           # 统一响应包络、日志
│   ├── pipes/                  # Zod 校验
│   └── utils/                  # 分页、编号生成、时间
├── prisma/                     # PrismaService
├── auth/
│   ├── internal-auth.controller.ts
│   ├── supplier-auth.controller.ts
│   ├── auth.config.ts          # 两个 Better Auth 实例
│   └── account.service.ts      # 账号创建、禁用、重置密码
├── mail/                       # MailService、模板、MailLog
├── storage/                    # StorageService、本地实现
└── modules/
    ├── users/                  # 内部用户管理
    ├── suppliers/              # 供应商、账号、可见范围、评级
    ├── projects/
    ├── inquiries/
    ├── quotes/
    ├── orders/
    ├── contracts/
    ├── invoices/
    ├── dashboard/
    └── settings/
```

**前端 `supplier-microplatform-nextjs`**

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (internal)/
│   ├── layout.tsx              # 内部端侧边栏布局
│   ├── dashboard/page.tsx
│   ├── projects/...
│   ├── suppliers/...
│   ├── admin/...
│   └── account/page.tsx
├── supplier/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   └── (portal)/layout.tsx     # 供应商端顶部导航布局
├── error.tsx / not-found.tsx / forbidden/page.tsx
└── layout.tsx

components/
├── layout/                     # Sidebar、Topbar、PageHeader、Breadcrumbs
├── ui/                         # 二次封装的 HeroUI 组件
├── suppliers/ projects/ inquiries/ orders/ shared/
lib/
├── api-client.ts               # fetch 封装、错误规范化
├── auth-client.ts              # 两个 Better Auth 客户端
├── query-client.ts
├── formatters.ts               # 金额、日期、倒计时
└── permissions.ts              # 前端权限判断（仅用于展示，后端为准）
```

> 约定：单文件超过约 300 行即拆分；页面只负责编排，业务逻辑下沉到 `components/*` 与 `lib/*`。

### 2.5 环境变量

**后端 `.env`（不提交仓库，提供 `.env.example`）**

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:prisma@localhost:5432/supplier_microplatform` | 数据库连接 |
| `PORT` | `3100` | Nest 端口 |
| `APP_URL` | `http://localhost:3000` | 前端地址，用于邮件中的平台链接与重置密码链接 |
| `INTERNAL_AUTH_SECRET` | 32+ 随机字符 | 内部账号 Better Auth 密钥 |
| `SUPPLIER_AUTH_SECRET` | 32+ 随机字符 | 供应商账号 Better Auth 密钥 |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | `127.0.0.1` / `1025` / `false` | 本地默认指向 Mailpit；生产改为真实 SMTP（如 `smtp.example.com` / `465` / `true`） |
| `MAIL_USER` / `MAIL_PASS` | 本地留空 | 发件账号；Mailpit 不校验，生产必填 |
| `MAIL_FROM` | `供应商微平台 <no-reply@local.test>` | 统一发件人 |
| `STORAGE_DIR` | `./storage/uploads` | 附件目录 |
| `MAX_UPLOAD_MB` | `20` | 单文件大小上限 |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | — | 初始化管理员 |
| `TZ` | `Asia/Shanghai` | 展示时区 |

**前端 `.env.local`**

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://localhost:3100` | `next.config.ts` 代理目标（仅服务端使用） |
| `NEXT_PUBLIC_APP_NAME` | `供应商微平台` | 页面标题与品牌名 |
| `NEXT_PUBLIC_API_BASE` | `/api` | 浏览器请求前缀 |

### 2.6 本地开发环境（Docker Compose）

本地开发使用仓库根目录的 `docker-compose.yml` 一键启动两个容器，保证团队成员环境一致。该文件只服务本地与 CI，不参与生产部署。

| 服务 | 镜像 | 端口（仅绑定 `127.0.0.1`） | 用途 |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `5432` | 业务数据库，数据持久化到 `pgdata` 卷 |
| `mailpit` | `axllent/mailpit` | `1025`（SMTP）/ `8025`（Web UI） | 本地邮件收件箱，只收不发，可查看 HTML、附件与原始 MIME |

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: prisma
      POSTGRES_DB: supplier_microplatform
      TZ: Asia/Shanghai
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit
    ports:
      - "127.0.0.1:1025:1025"
      - "127.0.0.1:8025:8025"
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

volumes:
  pgdata:
```

首次启动流程：

```bash
docker compose up -d      # 启动 PostgreSQL 与 Mailpit
docker compose ps         # 等 postgres 变为 healthy
pnpm db:migrate           # 建表（容器已自动建库，db:ensure 可跳过）
pnpm db:seed              # 初始化管理员
```

验证邮件：触发任一通知（发起询价、找回密码、账号开通等），打开 `http://localhost:8025` 查看收件人、正文、附件。

约定：

- 本地邮件永远发往 Mailpit，不会投递到真实邮箱；生产通过环境变量切换到真实 SMTP。
- 端口被占用时改映射（如 `5433:5432`），并同步修改 `DATABASE_URL`。
- `docker compose down` 保留数据；`docker compose down -v` 清空数据卷后需重新迁移与种子。
- 本地无 Docker 时，可自行安装 PostgreSQL，并用 Mailpit 本地模式或 Ethereal 临时账号替代邮件测试。

---

## 3. 账号、角色与权限

### 3.1 双账号体系

采用 **两个独立 Better Auth 实例**，共用同一个 PostgreSQL 数据库，但使用独立的表与会话 Cookie：

| 项 | 内部账号 | 供应商账号 |
| --- | --- | --- |
| 登录入口 | `/login` | `/supplier/login` |
| Auth Base Path | `/api/auth/internal` | `/api/auth/supplier` |
| Cookie 前缀 | `internal` | `supplier` |
| 数据表 | `internal_user` / `internal_session` / `internal_account` / `internal_verification` | `supplier_user` / `supplier_session` / `supplier_account` / `supplier_verification` |
| 必填字段 | 姓名、用户名、邮箱、密码、角色 | 姓名、用户名、邮箱、密码、所属供应商 |
| 创建者 | 管理员（首个管理员由种子脚本创建） | 有权限的内部用户（管理员或供应商创建者） |
| 业务扩展 | `role`、`phone`、`isActive`、`mustChangePassword`、`deletedAt` | `supplierId`、`phone`、`title`、`isPrimary`、`isActive`、`mustChangePassword`、`deletedAt` |

一个供应商可创建多个业务员账号；每个供应商账号只能绑定一个供应商，不能跨企业。

设计理由：

- 满足「两套账号体系」的隔离要求，供应商账号被盗或误删不影响内部账号。
- 两套会话互不干扰，同一浏览器可同时登录内部端与供应商端。
- 同一邮箱允许分别存在于两套体系（例如员工同时是某供应商联系人），互不冲突。

> 不启用 Better Auth `admin` 插件：其角色/会话权限模型与本平台「普通内部用户也能创建供应商账号」的规则不一致。账号创建、禁用、重置统一由 `AccountService` 通过 Better Auth 核心 API + Prisma 完成，业务权限由 Nest 守卫判断。

### 3.2 登录与找回密码

1. **登录标识**：用户名或邮箱 + 密码。前端判断输入是否包含 `@`：包含则调用 `signIn.email`，否则调用 `signIn.username`（用户名插件）。
2. **邮箱必填**：创建账号时邮箱为必填且唯一；用于找回密码与通知。
3. **不提供注册**：两套体系均无公开注册入口；登录页不出现「注册」链接。
4. **找回密码**：
   - 用户在对应入口提交邮箱 → Better Auth 生成重置令牌并回调 `sendResetPassword`；
   - `MailService` 发送重置邮件，链接指向对应端的 `/reset-password?token=...`；
   - 无论邮箱是否存在，接口都返回成功提示，避免账号枚举；
   - 重置成功后跳转登录页，旧会话建议全部失效（Better Auth 默认行为）。
5. **密码策略**：至少 8 位，包含字母与数字；前端提示、后端与 Better Auth 双重校验。
6. **首次登录强制改密**：管理员/内部用户创建账号时生成一次性初始密码；账号 `mustChangePassword=true`，登录后只能访问改密页，改密成功前其他业务接口返回 `403 PASSWORD_CHANGE_REQUIRED`。
7. **登录失败提示**：统一提示「账号或密码错误」，不区分用户是否存在。

### 3.3 账号生命周期

| 动作 | 内部账号 | 供应商账号 |
| --- | --- | --- |
| 创建 | 管理员在「用户管理」创建，填写姓名/用户名/邮箱/角色；系统生成一次性初始密码并发送账号邮件 | 有权限的内部用户在供应商详情创建，绑定供应商；系统生成一次性初始密码并发送邀请邮件 |
| 首次登录 | 使用一次性初始密码登录后，必须先修改密码才能进入系统 | 同左 |
| 修改 | 管理员可改姓名、角色、手机、状态 | 管理员/供应商创建者可改姓名、手机、职位、状态 |
| 禁用 | `isActive=false`，清除该用户全部会话；登录时提示账号已停用 | 同左 |
| 删除 | 语义为「停用并隐藏」，保留历史数据；用户名/邮箱仍占用 | 同左 |
| 重置密码 | 管理员在用户管理触发重置邮件 | 管理员/创建者触发重置邮件；供应商也可自助找回 |
| 首个管理员 | `prisma db seed` 读取 `SEED_ADMIN_*` 创建；已存在则跳过 | — |

> 账号禁用与删除不做物理删除，避免历史项目、报价、合同中的操作人信息丢失。

### 3.4 权限矩阵

| 能力 | 管理员 | 内部用户（数据创建者） | 内部用户（其他） | 供应商 |
| --- | :---: | :---: | :---: | :---: |
| 查看项目列表/详情 | ✅ | ✅ | ✅ | ❌ |
| 新建项目 | ✅ | ✅ | ✅ | ❌ |
| 编辑项目、新增/编辑询价项 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 开放/关闭/重新开放询价 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 查看报价、报价对比 | ✅ | ✅ | ✅ | 仅自己的报价 |
| 选标并生成订单 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 标记订单完成 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 审核合同、回传修订版 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 签署验收单 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 查看供应商列表/详情 | ✅ | 全部可见范围内 | 全部可见范围内 | 仅自己企业 |
| 新建供应商 | ✅ | ✅ | ✅ | ❌ |
| 编辑供应商、管理其账号与可见范围 | ✅ | ✅（自己创建） | ❌ | ❌ |
| 给供应商评级 | ✅ | ✅ | ✅（可见范围内） | ❌ |
| 内部用户管理 | ✅ | ❌ | ❌ | ❌ |
| 系统设置、邮件日志、操作日志 | ✅ | ❌ | ❌ | ❌ |
| 查看被邀请且开放中的询价 | ❌ | ❌ | ❌ | ✅ |
| 查看自己的历史报价（只读） | ❌ | ❌ | ❌ | ✅（仅自己提交过） |
| 提交/修改报价 | ❌ | ❌ | ❌ | ✅ |
| 提交合同、验收单、发票与请款 | ❌ | ❌ | ❌ | ✅（自己的订单） |

> 前端权限仅控制按钮显隐，**所有权限判断必须以后端守卫与服务层校验为准**。

### 3.5 供应商可见范围

- 每个供应商有 `visibilityScope`：
  - `ALL`：所有内部用户可见、可搜索、可在询价中选择；
  - `SPECIFIED`：仅创建者、管理员、`supplier_visibility_user` 中列出的内部用户可见。
- 可见范围影响：供应商列表、供应商详情、询价项选择供应商、评级入口、合作记录。
- 不影响：项目本身、供应商已提交的报价与合同（属于项目上下文，按项目权限控制）。
- 可见范围只可由管理员或供应商创建者修改。
- 供应商账号（供应商业务员）不受内部可见范围影响，账号持有者始终能登录自己企业。

### 3.6 供应商评级

1. 评分维度：报价质量 `quoteQuality`、响应速度 `responseSpeed`、服务态度 `serviceAttitude`，各 1–5 分。
2. 综合分：三维平均，保留 1 位小数。
3. 评价主体：能看见该供应商的内部用户；评价必须关联一次询价（`inquiryId`），避免脱离业务上下文的刷分。
4. 唯一性：同一评价人对同一供应商的同一询价只能评价一次（`unique(supplierId, ratedByUserId, inquiryId)`），可修改评分。
5. 聚合：`supplier.ratingAvg` 与 `ratingCount` 在新增/修改/删除评价后同步重算（事务内）。
6. 展示：供应商列表显示综合分与评价次数；详情页展示三维均分与评价历史。供应商端不展示评级。

### 3.7 会话与守卫实现要点

- 守卫从请求头读取 Cookie，调用对应实例的 `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`。
- 会话有效后再校验业务状态：`isActive === true` 且 `deletedAt == null`；否则清除会话并返回 401。
- 若 `mustChangePassword === true`，除「获取会话」「修改密码」「退出登录」外，其余业务接口返回 `403 PASSWORD_CHANGE_REQUIRED`；前端强制跳转 `/change-password` 或 `/supplier/change-password`。
- 内部接口挂 `InternalAuthGuard`，供应商接口挂 `SupplierAuthGuard`；管理员接口再叠加 `@Roles('ADMIN')`。
- 供应商接口从会话中取 `supplierId`，所有查询强制附加 `supplierId` 条件，禁止通过请求参数越权。
- 登录态失效时前端统一跳转对应登录页，并携带 `redirect` 参数。

---

## 4. 核心业务流程与状态机

### 4.1 项目与询价项

**项目状态**：`ACTIVE`（进行中）→ `ARCHIVED`（归档，只读）。项目不设置复杂流转，进度由下属询价项与订单推导。

**询价项状态机**

```mermaid
stateDiagram-v2
    [*] --> DRAFT: 创建项目自动生成 / 新增询价项
    DRAFT --> OPEN: 一键发送询价邮件
    OPEN --> CLOSED: 到期自动关闭 / 手动关闭
    CLOSED --> OPEN: 重新开放（设置新截止时间）
    CLOSED --> AWARDED: 选定供应商并生成订单
    DRAFT --> CANCELLED: 作废
    CLOSED --> CANCELLED: 作废
    AWARDED --> [*]
    CANCELLED --> [*]
```

| 状态 | 含义 | 可执行操作 |
| --- | --- | --- |
| `DRAFT` | 草稿，尚未通知供应商 | 编辑全部字段、增删受邀供应商、设置期限、发送询价 |
| `OPEN` | 已发送，供应商可报价 | 查看报价、手动关闭；关闭后可重新开放 |
| `CLOSED` | 已截止，停止报价 | 查看报价、对比、选标、重新开放、作废 |
| `AWARDED` | 已选定供应商 | 查看订单；询价内容只读 |
| `CANCELLED` | 已作废 | 只读 |

业务规则：

1. 新建项目时**自动生成一个默认询价项**（`DRAFT`），项目下可继续新增多个询价项。
2. 询价项默认开放期限 15 天；创建/重开时可指定截止时间，必须晚于当前时间。
3. 发送询价（`DRAFT → OPEN`）的前置条件：至少选择一个受邀供应商、截止时间未过、询价内容完整。
4. 开放即发送邮件；部分供应商发送失败不回滚开放状态，失败记录在 `inquiry_supplier.mailStatus` 与邮件日志中，可单独重发。
5. 到期自动关闭由 `@nestjs/schedule` 每分钟扫描 `OPEN` 且 `deadline <= now` 的询价项完成；手动关闭立即生效。
6. `CLOSED` 重新开放时需重新设置截止时间（默认当前 +15 天），并可选是否再次发送邮件。
7. 选标只能在 `CLOSED` 且至少有一份报价时进行；选标成功后询价项进入 `AWARDED`，不可重复选标。
8. 询价项进入 `OPEN` 后不可修改询价内容与受邀供应商，避免与已发出的邮件不一致；如需修改，先关闭→作废后新建。

### 4.2 询价与报价流程

```mermaid
sequenceDiagram
    participant IU as 内部用户
    participant P as 平台
    participant S as 供应商
    IU->>P: 创建项目 + 默认询价项
    IU->>P: 选择供应商、设置截止时间
    IU->>P: 一键发送询价
    P-->>S: 询价邮件（项目信息 + 平台网址 + 联系方式）
    S->>P: 登录查看开放中的询价
    S->>P: 上传报价文件 + 填写单价/交期/说明
    P-->>IU: 报价通知邮件（含报价文件与补充说明）
    IU->>P: 关闭询价 / 到期自动关闭
    IU->>P: 对比报价并选定供应商
    P-->>S: 订单邮件（通知提交合同）
```

**报价规则**

1. 供应商的「待报价/已报价」列表只展示「被邀请 + 状态 OPEN」的询价项；已关闭/已选标的询价不再出现在开放列表，但可在「我的报价历史」中以只读方式查看自己提交过的报价。
2. 一个供应商对一个询价项只有一份有效报价；截止前可修改，`version` 递增，并保留提交时间与操作人。
3. 报价必填：单价、总价（默认单价 × 数量，可手动调整）、币种（默认 CNY）、报价有效期、附件（报价单）；选填：交期、补充说明。
4. 每次提交或修改报价，都会给项目联系人 + 项目创建者发送邮件（附件为最新报价文件）。
5. 截止时间以服务端时间为准；关闭状态、非受邀供应商的提交一律拒绝。
6. 报价提交必须使用事务：写入/更新报价 → 更新版本 → 记录附件 → 写邮件任务/日志 → 提交成功后发信。

### 4.3 订单与合同

**选标生成订单**

- 询价项 `CLOSED` → 内部选择供应商 → 校验报价存在 → 事务内：创建订单、创建合同（`PENDING_SUBMISSION`）、更新询价项为 `AWARDED`。
- 订单号规则：`ORD-YYYYMMDD-XXXX`（当天序号，唯一索引兜底）。
- 生成后立即向该供应商发送「订单已生成，请提交合同」邮件。

**合同状态机**

```mermaid
stateDiagram-v2
    [*] --> PENDING_SUBMISSION: 订单生成
    PENDING_SUBMISSION --> SUBMITTED: 供应商上传合同
    SUBMITTED --> RETURNED: 内部回传修订版
    RETURNED --> COMPLETED: 线下签署完成（内部标记，可选）
    SUBMITTED --> SUBMITTED: 供应商在审核前重新上传
```

| 合同状态 | 含义 | 可执行操作 |
| --- | --- | --- |
| `PENDING_SUBMISSION` | 等待供应商提交 | 供应商上传合同文件（必填）+ 备注 |
| `SUBMITTED` | 已提交，等待内部审核 | 内部下载、回传修订版；供应商可重新上传 |
| `RETURNED` | 内部已回传修订版 | 供应商下载；等待线下签署 |
| `COMPLETED` | 线下签署完成（可选） | 只读 |

**订单状态机**

| 状态 | 触发 | 说明 |
| --- | --- | --- |
| `PENDING_CONTRACT` | 选标生成订单 | 等待供应商提交合同 |
| `IN_PROGRESS` | 合同首次提交 | 进入履约阶段；发票可提交 |
| `COMPLETED` | 项目创建者或管理员手动标记 | 订单完成；此后禁止提交发票/请款与验收单 |
| `CANCELLED` | 项目创建者或管理员取消 | 只读，禁止新提交 |

> 订单状态与合同状态分离：合同多次往来不影响订单履约状态；发票资格只取决于订单是否 `COMPLETED/CANCELLED`。
>
> **订单完成权限**：由订单所属项目的创建者或管理员标记完成；其他内部用户不可操作。

**验收单（可选流程）**

1. 验收单不是订单完成的必需条件；订单是否完成由内部根据实际履约情况判断。
2. 供应商可在订单详情上传验收单（可选），文件类型为 PDF/图片；上传后内部可下载查看。
3. 内部确认无误后「签署」：上传签署版验收单，或标记为已签署（二选一，建议上传签署版留档）。
4. 验收单状态：`UPLOADED`（供应商已上传）→ `SIGNED`（内部已签署）；未上传时不建记录。
5. 验收单附件使用 `attachment(scope=ORDER, kind=ACCEPTANCE_FILE / SIGNED_ACCEPTANCE)`；每次上传保留历史，最新版本在页面突出显示。
6. 订单完成后，供应商不可再上传或修改验收单；内部仍可查看历史文件。

### 4.4 发票与请款

1. 供应商可对**未完成且未取消**的订单提交发票与请款材料，不要求合同已回传。
2. 一次提交包含：发票号、金额（默认订单金额，可改）、发票文件（必填）、请款书文件（必填）、备注。
3. 一个订单允许多次提交，每次生成独立记录；提交后给项目联系人 + 创建者发邮件。
4. **本期不做发票审核/驳回**：内部只查看提交记录与附件，不改变记录状态；财务审核后续接入。
5. 订单标记完成后，供应商端「提交发票/请款」按钮禁用，服务端同步拒绝。
6. **后续演进（本期不实施）**：发票校验 → 对账 → 支付证明单（付款申请书）生成；本期仅保留提交与查看，不引入校验/对账/付款状态与对应接口（见 1.6）。

### 4.5 邮件通知矩阵

| 触发事件 | 模板 Key | 收件人 | 附件 |
| --- | --- | --- | --- |
| 询价开放 | `inquiry.opened` | 各受邀供应商账号邮箱 | 询价附件（如有） |
| 供应商提交/修改报价 | `quote.submitted` | 项目联系人 + 项目创建者 | 最新报价文件 |
| 选标生成订单 | `order.created` | 中标供应商 | — |
| 供应商提交合同 | `contract.submitted` | 项目联系人 + 项目创建者 | 合同文件 |
| 内部回传修订合同 | `contract.returned` | 该订单供应商 | 修订版合同 |
| 供应商上传验收单 | `acceptance.uploaded` | 项目联系人 + 项目创建者 | 验收单 |
| 内部签署验收单 | `acceptance.signed` | 该订单供应商 | 签署版验收单 |
| 供应商提交发票/请款 | `invoice.submitted` | 项目联系人 + 项目创建者 | 发票 + 请款书 |
| 创建账号 | `account.created` | 新账号邮箱 | —（正文含一次性初始密码与强制改密提示） |
| 重置密码 | `account.reset-password` | 目标账号邮箱 | — |

邮件内容统一包含：平台名称、业务摘要、跳转按钮（平台网址）、内部联系人及「如有疑问，请联系 XXX」、自动发送声明。

### 4.6 并发与一致性规则

- **选标防重**：订单表 `inquiryId` 唯一索引；同时只允许一次选标成功。
- **报价防重**：`unique(inquiryId, supplierId)`，提交使用 upsert。
- **状态校验**：所有状态变更先读当前状态并校验合法迁移，再在事务内更新；禁止仅依赖前端传值。
- **条件更新**：关闭、选标、合同回传、订单完成、验收单签署等操作统一使用 `updateMany({ where: { id, status: 期望状态 }, data: ... })`，并校验影响行数为 1；影响行数为 0 时返回 `409 INVALID_STATE`，避免定时任务与手动操作、多个用户同时操作的竞态。
- **审计**：关键状态变更在同一业务事务提交后写入 `audit_log`（或与业务更新同事务），记录操作人、动作、目标与前后状态。
- **邮件失败不回滚业务**：业务事务提交后写入 `mail_log`，发送失败保留错误信息，可重试。
- **截止时间**：服务端时间统一 UTC 存储，展示时转换 `Asia/Shanghai`；所有「是否截止」判断以服务端为准。

---

## 5. 数据模型设计

### 5.1 设计原则

1. 使用 Prisma ORM；`datasource` 配置 `relationMode = "prisma"`，**不生成数据库外键约束**，关联由应用层维护。
2. 主键统一 `String @id @default(cuid())`；业务编号（项目号、询价号、订单号）单独字段并建唯一索引。
3. 金额使用 `Decimal`（订单/报价 `@db.Decimal(16, 2)`），数量 `@db.Decimal(14, 3)`；禁止使用浮点数。
4. 时间统一存 UTC（`DateTime`），展示按 `Asia/Shanghai`；日期类字段（如报价有效期）使用 `DateTime @db.Date`。
5. 需要保留历史的实体不做物理删除：账号用 `isActive + deletedAt`，供应商用 `status`。
6. 附件采用「通用附件表 + 业务范围」的多态设计，避免为每个业务建一套文件表。
7. 两个 Better Auth 实例的用户/会话表分别命名，业务表通过用户 ID 逻辑关联。

### 5.2 枚举

```prisma
enum InternalRole      { ADMIN MEMBER }
enum SupplierStatus    { ACTIVE DISABLED }
enum VisibilityScope   { ALL SPECIFIED }
enum ProjectStatus     { ACTIVE ARCHIVED }
enum InquiryStatus     { DRAFT OPEN CLOSED AWARDED CANCELLED }
enum InviteMailStatus  { PENDING SENT FAILED }
enum OrderStatus       { PENDING_CONTRACT IN_PROGRESS COMPLETED CANCELLED }
enum ContractStatus    { PENDING_SUBMISSION SUBMITTED RETURNED COMPLETED }
enum AcceptanceStatus  { UPLOADED SIGNED }
enum AttachmentScope   { TEMP PROJECT INQUIRY QUOTE CONTRACT ORDER INVOICE SUPPLIER }
enum AttachmentKind    { GENERAL QUOTE_FILE CONTRACT_FILE ACCEPTANCE_FILE SIGNED_ACCEPTANCE INVOICE_FILE PAYMENT_REQUEST }
enum UploaderType      { INTERNAL SUPPLIER }
enum AuditActorType    { INTERNAL SUPPLIER SYSTEM }
enum MailStatus        { PENDING SENT FAILED }
```

### 5.3 账号表（Better Auth 生成 + 业务扩展字段）

| 表 | 关键字段 | 约束 | 说明 |
| --- | --- | --- | --- |
| `internal_user` | id, name, email, emailVerified, username, displayUsername, role, phone, isActive, mustChangePassword, deletedAt | `email` 唯一、`username` 唯一 | 内部账号；`role` 为 `ADMIN/MEMBER` |
| `internal_session` / `internal_account` / `internal_verification` | 由 Better Auth 管理 | 按官方生成 | 会话、密码凭据、令牌 |
| `supplier_user` | id, name, email, emailVerified, username, displayUsername, supplierId, phone, title, isPrimary, isActive, mustChangePassword, deletedAt | `email` 唯一、`username` 唯一；`supplierId` 普通索引 | 供应商业务员账号 |
| `supplier_session` / `supplier_account` / `supplier_verification` | 由 Better Auth 管理 | 按官方生成 | 供应商侧会话与凭据 |

> 生成方式：分别以两个实例配置运行 Better Auth CLI 生成 schema，模型名映射为 `internalUser/internalSession/...` 与 `supplierUser/supplierSession/...`，合并进 `prisma/schema.prisma`。实施时以所安装 Better Auth 版本的 CLI 行为为准。

### 5.4 业务表

| 表 | 关键字段 | 唯一约束/索引 | 说明 |
| --- | --- | --- | --- |
| `supplier` | id, code, name, shortName, category, address, website, taxId, remark, status, visibilityScope, ratingAvg, ratingCount, createdByUserId, createdAt, updatedAt | `code` 唯一；`(status, visibilityScope)`、`name` 索引 | 供应商主档 |
| `supplier_visibility_user` | id, supplierId, userId, createdAt | `unique(supplierId, userId)` | 指定可见的内部用户 |
| `supplier_rating` | id, supplierId, ratedByUserId, inquiryId, quoteQuality, responseSpeed, serviceAttitude, score, comment, createdAt, updatedAt | `unique(supplierId, ratedByUserId, inquiryId)` | 三维评分，`score` 为平均分 |
| `project` | id, code, name, customerName, description, contactName, contactEmail, contactPhone, status, createdByUserId, createdAt, updatedAt, archivedAt | `code` 唯一；`(status, createdAt)` 索引 | 项目主档；联系信息用于询价邮件 |
| `inquiry` | id, code, projectId, title, description, quantity, unit, deadline, status, openedAt, closedAt, awardedAt, createdByUserId, createdAt, updatedAt | `code` 唯一；`(projectId, status)`、`(status, deadline)` 索引 | 询价项 |
| `inquiry_supplier` | id, inquiryId, supplierId, mailStatus, mailError, sentAt, createdAt | `unique(inquiryId, supplierId)`；`supplierId` 索引 | 受邀供应商与发信状态 |
| `quote` | id, inquiryId, supplierId, unitPrice, totalPrice, currency, deliveryDays, validUntil, note, version, submittedAt, updatedAt | `unique(inquiryId, supplierId)` | 一个供应商一份当前报价 |
| `order` | id, orderNo, projectId, inquiryId, supplierId, quoteId, amount, currency, status, createdByUserId, completedAt, createdAt, updatedAt | `orderNo` 唯一、`inquiryId` 唯一、`quoteId` 唯一；`(supplierId, status)` 索引 | 选标生成的订单 |
| `contract` | id, orderId, status, supplierNote, submittedAt, returnedAt, completedAt, updatedAt | `orderId` 唯一 | 订单合同主记录 |
| `contract_file` | id, contractId, attachmentId, direction, note, uploadedByType, uploadedById, createdAt | `(contractId, createdAt)` 索引 | 合同文件版本（供应商上传/内部回传） |
| `acceptance_certificate` | id, orderId, status, supplierFileId, signedFileId, uploadedBySupplierUserId, signedByUserId, uploadedAt, signedAt, updatedAt | `orderId` 唯一 | 可选验收单；未上传时无记录，上传后只能签署一次 |
| `invoice` | id, orderId, supplierId, invoiceNo, amount, currency, note, submittedBySupplierUserId, createdAt | `(orderId, createdAt)` 索引 | 发票与请款提交记录；本期无审核状态 |
| `attachment` | id, scope, scopeId, kind, fileName, mimeType, size, storageKey, uploadedByType, uploadedById, createdAt | `(scope, scopeId)` 索引 | 通用附件；验收单使用 `scope=ORDER` |
| `audit_log` | id, actorType, actorId, actorName, action, targetType, targetId, summary, beforeData, afterData, ip, userAgent, createdAt | `(targetType, targetId)`、`(actorType, actorId)`、`createdAt` 索引 | 关键操作审计 |
| `mail_log` | id, templateKey, toEmails, ccEmails, subject, status, attempts, error, relatedType, relatedId, payload, createdAt, sentAt | `(status, createdAt)`、`(relatedType, relatedId)` 索引 | 邮件发送记录 |
| `system_setting` | key, value, updatedAt | `key` 主键 | 平台名称、平台地址、默认联系信息等 |

### 5.5 重要一致性规则

- `order.inquiryId` 唯一，保证一个询价项只能生成一个订单，从数据库层阻止重复选标。
- `quote(inquiryId, supplierId)` 唯一，报价提交使用 upsert。
- 供应商停用不删除其账号行；登录守卫与账号列表同时按 `isActive/deletedAt` 过滤。
- 删除供应商账号时同步清理其会话记录（`supplier_session`），并保留历史业务数据中的用户 ID。
- 附件与业务记录不做数据库级级联，删除/作废时由服务层显式处理。
- 评级聚合、订单状态、合同状态更新必须在事务中完成，避免统计与明细不一致。
- 验收单每个订单最多一条记录；供应商上传后内部才能签署，签署后不可重复签署；订单完成后禁止再上传。
- 关键操作（发送询价、关闭/重开、选标、合同提交/回传、订单完成/取消、验收单签署、账号停用）写入 `audit_log`，与业务更新同事务或业务提交后立即写入。

### 5.6 附件存储

- 文件保存路径：`${STORAGE_DIR}/{yyyy}/{MM}/{uuid}.{ext}`，数据库只保存 `storageKey`（相对路径）。
- 上传约束：单文件 ≤ `MAX_UPLOAD_MB`；允许 PDF、Word、Excel、图片；文件名做安全清洗。
- 下载分两步：`POST /api/files/:id/access-token` 校验会话与数据权限后，返回 5 分钟有效的签名下载 URL；下载接口同时校验签名、会话与数据权限，禁止直接暴露磁盘路径。
- 邮件中的附件仍以附件形式发送，不在邮件正文中放入长期有效的下载链接。
- 上传后未绑定业务的附件 `scope=TEMP`，由定时任务每天清理超过 24 小时的临时附件，避免磁盘膨胀。
- `StorageService` 接口预留 `put/get/delete/getSignedUrl`，当前使用本地磁盘实现。

### 5.7 数据库初始化与迁移

1. **确保数据库存在**：`pnpm db:ensure` 运行 `scripts/ensure-database.ts`，使用 `pg` 连接 `postgres` 系统库，查询 `pg_database`，不存在则 `CREATE DATABASE supplier_microplatform`。使用 `docker-compose` 时 `POSTGRES_DB` 已建库，该步骤可跳过（脚本保留以兼容本地直装 PostgreSQL 的场景）。
2. **迁移脚本**：`package.json` 中定义
   - `db:ensure`: `tsx scripts/ensure-database.ts`（需新增 `tsx` 开发依赖）
   - `db:migrate`: `pnpm db:ensure && prisma migrate dev`
   - `db:deploy`: `pnpm db:ensure && prisma migrate deploy`
   - `db:seed`: `prisma db seed`
3. **种子数据**：创建首个管理员（读取 `SEED_ADMIN_*`），可选创建演示供应商与项目（仅开发环境）。
4. Prisma Client 通过 `PrismaService` 注入，`onModuleInit` 建立连接，`onModuleDestroy` 断开。

---

## 6. API 设计

### 6.1 通用规范

- 基础路径：`/api`（Nest 全局前缀）；认证接口由 Better Auth 接管，挂在 `/api/auth/internal/*` 与 `/api/auth/supplier/*`。
- 数据格式：JSON；上传接口为 `multipart/form-data`。
- 认证：Cookie 会话；内部接口与供应商接口使用不同守卫。
- 校验：Zod Schema + `StandardSchemaValidationPipe`；错误信息中文化。
- 分页参数：`page`（默认 1）、`pageSize`（默认 20，最大 100）；响应返回 `meta`。
- 排序：`sortBy`、`sortOrder=asc|desc`，白名单字段。
- 时间：ISO 8601 字符串；金额：字符串形式的 Decimal（避免 JS 精度问题）。
- 幂等：状态类操作（发送、关闭、选标、完成订单）重复调用返回明确业务错误，不产生重复数据。

**成功响应**

```json
{
  "success": true,
  "data": { "id": "clx...", "name": "示例项目" },
  "meta": { "page": 1, "pageSize": 20, "total": 42 }
}
```

**失败响应**

```json
{
  "success": false,
  "error": { "code": "INQUIRY_CLOSED", "message": "询价已关闭，无法提交报价", "details": null },
  "requestId": "req_01J..."
}
```

### 6.2 认证接口（Better Auth 托管）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/internal/sign-in/email` | 内部账号邮箱登录 |
| POST | `/api/auth/internal/sign-in/username` | 内部账号用户名登录 |
| GET | `/api/auth/internal/get-session` | 获取内部会话 |
| POST | `/api/auth/internal/sign-out` | 退出 |
| POST | `/api/auth/internal/request-password-reset` | 发送重置邮件 |
| POST | `/api/auth/internal/reset-password` | 重置密码 |
| POST | `/api/auth/internal/change-password` | 登录后修改密码；首次登录强制改密同样走此接口 |
| POST | 供应商侧相同路径（前缀 `/api/auth/supplier`） | 供应商登录与找回密码 |

> 路由名以所安装 Better Auth 版本为准；前端统一封装在 `lib/auth-client.ts`，页面不直接拼接路径。

### 6.3 内部端业务接口

| 分组 | 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- | --- |
| 当前用户 | GET | `/api/me` | 内部 | 会话用户 + 业务资料 |
| 当前用户 | PATCH | `/api/me` | 内部 | 修改姓名/手机；改密走 Better Auth |
| 工作台 | GET | `/api/dashboard` | 内部 | KPI、待办、最近项目、即将截止询价 |
| 用户管理 | GET | `/api/admin/users` | 管理员 | 分页、关键词、角色、状态筛选 |
| 用户管理 | POST | `/api/admin/users` | 管理员 | 创建内部用户并发送账号邮件 |
| 用户管理 | PATCH | `/api/admin/users/:id` | 管理员 | 修改姓名/角色/手机 |
| 用户管理 | POST | `/api/admin/users/:id/reset-password` | 管理员 | 触发重置密码邮件 |
| 用户管理 | POST | `/api/admin/users/:id/status` | 管理员 | 启用/停用（不可停用自己与最后一个管理员） |
| 供应商 | GET | `/api/suppliers` | 内部 | 关键词、评级、可见范围、状态筛选 |
| 供应商 | POST | `/api/suppliers` | 内部 | 创建供应商，可同时创建首个账号 |
| 供应商 | GET | `/api/suppliers/:id` | 可见范围 | 详情 + 账号 + 评级 + 合作记录摘要 |
| 供应商 | PATCH | `/api/suppliers/:id` | 管理员/创建者 | 编辑资料 |
| 供应商 | PATCH | `/api/suppliers/:id/visibility` | 管理员/创建者 | 设置全员/指定用户 |
| 供应商账号 | POST | `/api/suppliers/:id/accounts` | 管理员/创建者 | 创建账号并发送邀请邮件 |
| 供应商账号 | PATCH | `/api/supplier-accounts/:id` | 管理员/创建者 | 修改姓名/手机/职位/状态 |
| 供应商账号 | POST | `/api/supplier-accounts/:id/reset-password` | 管理员/创建者 | 触发重置邮件 |
| 供应商账号 | DELETE | `/api/supplier-accounts/:id` | 管理员/创建者 | 停用并隐藏 |
| 评级 | POST | `/api/suppliers/:id/ratings` | 可见范围 | 新增/更新对该供应商某询价的评分 |
| 评级 | GET | `/api/suppliers/:id/ratings` | 可见范围 | 评分历史与三维均分 |
| 项目 | GET | `/api/projects` | 内部 | 关键词、状态、负责人、时间筛选 |
| 项目 | POST | `/api/projects` | 内部 | 创建项目 + 默认询价项（可选） |
| 项目 | GET | `/api/projects/:id` | 内部 | 详情 + 询价项 + 订单摘要 |
| 项目 | PATCH | `/api/projects/:id` | 管理员/创建者 | 编辑项目信息 |
| 项目 | POST | `/api/projects/:id/archive` | 管理员/创建者 | 归档 |
| 询价项 | GET | `/api/projects/:projectId/inquiries` | 内部 | 询价项列表 |
| 询价项 | POST | `/api/projects/:projectId/inquiries` | 管理员/创建者 | 新增询价项（DRAFT） |
| 询价项 | GET | `/api/inquiries/:id` | 内部 | 详情 + 受邀供应商 + 报价摘要 |
| 询价项 | PATCH | `/api/inquiries/:id` | 管理员/创建者 | 仅 DRAFT 可编辑 |
| 询价项 | DELETE | `/api/inquiries/:id` | 管理员/创建者 | 仅 DRAFT 可删除 |
| 询价项 | POST | `/api/inquiries/:id/send` | 管理员/创建者 | DRAFT → OPEN，发送询价邮件 |
| 询价项 | POST | `/api/inquiries/:id/close` | 管理员/创建者 | 手动关闭 |
| 询价项 | POST | `/api/inquiries/:id/reopen` | 管理员/创建者 | 设置新截止时间并重新开放 |
| 询价项 | POST | `/api/inquiries/:id/cancel` | 管理员/创建者 | 作废 |
| 询价项 | POST | `/api/inquiries/:id/resend` | 管理员/创建者 | 向指定供应商重发询价邮件 |
| 报价 | GET | `/api/inquiries/:id/quotes` | 内部 | 报价列表（用于对比） |
| 报价 | GET | `/api/quotes/:id` | 内部 | 报价详情 + 附件 |
| 报价 | GET | `/api/inquiries/:id/quotes/export?format=xlsx` | 内部 | 导出报价对比表（Excel） |
| 选标 | POST | `/api/inquiries/:id/award` | 管理员/创建者 | 入参 `supplierId`，生成订单 |
| 订单 | GET | `/api/orders` | 内部 | 订单列表 |
| 订单 | GET | `/api/orders/:id` | 内部 | 订单 + 合同 + 验收单 + 发票 |
| 订单 | POST | `/api/orders/:id/complete` | 项目创建者/管理员 | 标记完成；完成后禁止新的合同/验收单/发票提交 |
| 订单 | POST | `/api/orders/:id/cancel` | 项目创建者/管理员 | 取消订单 |
| 合同 | POST | `/api/orders/:id/contract/return` | 项目创建者/管理员 | 上传修订版并回传供应商 |
| 合同 | POST | `/api/orders/:id/contract/complete` | 项目创建者/管理员 | 标记线下签署完成（可选） |
| 验收单 | POST | `/api/orders/:id/acceptance/sign` | 项目创建者/管理员 | 上传签署版或标记已签署；需已有供应商上传的验收单 |
| 发票 | GET | `/api/orders/:id/invoices` | 内部 | 发票/请款记录（只读，本期不审核） |
| 审计 | GET | `/api/admin/audit-logs` | 管理员 | 关键操作日志查询 |
| 系统设置 | GET | `/api/admin/settings` | 管理员 | 平台信息、邮件状态 |
| 系统设置 | PUT | `/api/admin/settings` | 管理员 | 更新平台名称/地址/默认联系人 |
| 邮件 | POST | `/api/admin/mail/test` | 管理员 | 测试发信 |
| 邮件 | GET | `/api/admin/mail-logs` | 管理员 | 邮件日志与失败重试 |

### 6.4 供应商端业务接口

| 分组 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 当前账号 | GET | `/api/supplier/me` | 账号 + 所属供应商信息 |
| 当前账号 | PATCH | `/api/supplier/me` | 修改姓名/手机/职位 |
| 工作台 | GET | `/api/supplier/dashboard` | 待报价、待提交合同、进行中订单等 |
| 询价 | GET | `/api/supplier/inquiries` | 仅被邀请且 OPEN 的询价项 |
| 询价 | GET | `/api/supplier/inquiries/:id` | 详情、附件、我的报价；已关闭询价仅允许从历史报价进入且只读 |
| 报价 | PUT | `/api/supplier/inquiries/:id/quote` | 提交或修改报价（含附件 ID 列表） |
| 报价历史 | GET | `/api/supplier/quote-history` | 自己提交过的报价（含已关闭/已选标），只读 |
| 订单 | GET | `/api/supplier/orders` | 自己的订单列表 |
| 订单 | GET | `/api/supplier/orders/:id` | 订单 + 合同 + 验收单 + 发票 |
| 合同 | POST | `/api/supplier/orders/:id/contract` | 上传合同文件与备注 |
| 验收单 | POST | `/api/supplier/orders/:id/acceptance` | 上传可选验收单（订单未完成时） |
| 发票 | POST | `/api/supplier/orders/:id/invoices` | 提交发票与请款 |

### 6.5 文件接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/files` | `multipart/form-data` 上传，返回 `{ id, fileName, size }`；仅生成临时附件，提交业务时绑定 `scope/scopeId` |
| POST | `/api/files/:id/access-token` | 校验会话与数据权限后，返回 5 分钟有效的签名下载 URL |
| GET | `/api/files/:id/download?expires=...&signature=...` | 校验签名、会话与数据权限后流式下载 |
| DELETE | `/api/files/:id` | 仅未绑定业务的临时附件，或提交前的替换 |

### 6.6 错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 参数校验失败 |
| 401 | `UNAUTHENTICATED` | 未登录或会话失效 |
| 403 | `FORBIDDEN` | 无权限（非创建者、非管理员、不可见供应商） |
| 403 | `ACCOUNT_DISABLED` | 账号已停用 |
| 403 | `PASSWORD_CHANGE_REQUIRED` | 首次登录未改密，禁止访问其他业务接口 |
| 403 | `INVALID_FILE_SIGNATURE` | 文件签名无效或已过期 |
| 404 | `NOT_FOUND` | 资源不存在或无权查看 |
| 409 | `INVALID_STATE` | 当前状态不允许该操作（如已关闭仍报价） |
| 409 | `ALREADY_AWARDED` | 询价项已选标 |
| 409 | `ORDER_COMPLETED` | 订单已完成，禁止提交合同/验收单/发票 |
| 409 | `ACCEPTANCE_NOT_UPLOADED` | 验收单尚未由供应商上传，无法签署 |
| 409 | `ACCEPTANCE_ALREADY_SIGNED` | 验收单已签署，不可重复签署 |
| 409 | `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL` | 用户名/邮箱冲突 |
| 413 | `FILE_TOO_LARGE` | 超出上传大小限制 |
| 422 | `QUOTE_DEADLINE_PASSED` | 报价截止 |
| 500 | `INTERNAL_ERROR` | 未预期错误 |

---

## 7. 邮件通知设计

### 7.1 发件与配置

- 统一使用平台配置的发件人 `MAIL_FROM`，通过 SMTP 发送；供应商与内部用户均收到来自平台的通知。
- 邮件采用 HTML 模板 + 纯文本降级；模板与渲染逻辑放在 `src/mail/templates/`，禁止在业务代码中拼接大段 HTML。
- 所有邮件正文必须包含：
  1. 平台名称与业务摘要；
  2. 平台访问地址按钮（`APP_URL`）；
  3. 内部联系人姓名、电话、邮箱，以及「如有疑问，请联系 XXX。」；
  4. 自动发送、请勿直接回复的声明（如需要可设置 Reply-To 为联系人邮箱）。

### 7.2 模板清单

| Key | 主题 | 正文要点 | 附件 |
| --- | --- | --- | --- |
| `inquiry.opened` | `【询价】{项目名称} - {询价项标题}` | 项目名称/编号、询价项描述、数量单位、截止时间、报价要求、平台链接、内部联系人 | 询价附件（如有） |
| `quote.submitted` | `【报价】{供应商名称} 已提交报价 - {询价项标题}` | 项目与询价项、供应商、单价/总价/交期/有效期、补充说明、平台链接 | 供应商报价文件 |
| `order.created` | `【订单】请提交合同 - {订单号}` | 项目、询价项、订单金额、合同提交入口、截止提醒 | — |
| `contract.submitted` | `【合同】{供应商名称} 已提交合同 - {订单号}` | 供应商、提交时间、备注、平台审核入口 | 合同文件 |
| `contract.returned` | `【合同】修订版合同已回传 - {订单号}` | 订单信息、内部备注、下一步线下签署说明 | 修订版合同 |
| `acceptance.uploaded` | `【验收单】{供应商名称} 已上传 - {订单号}` | 订单信息、上传时间、备注、平台签署入口 | 验收单 |
| `acceptance.signed` | `【验收单】已签署 - {订单号}` | 订单信息、签署时间、平台查看入口 | 签署版验收单 |
| `invoice.submitted` | `【发票/请款】{供应商名称} 已提交 - {订单号}` | 订单、发票号、金额、备注、平台查看入口 | 发票 + 请款书 |
| `account.created` | `【账号】{平台名称} 账号已开通` | 用户名、登录地址、**一次性初始密码**、首次登录强制改密提示 | — |
| `account.reset-password` | `【账号】重置密码` | 重置按钮/链接、有效期、非本人操作提示 | — |

### 7.3 收件人规则

- 供应商相关通知只发给**该供应商下的账号邮箱**（可配置主联系人优先，MVP 发给该供应商全部启用账号并去重）。
- 内部通知发给 `project.contactEmail` 与 `project.createdBy` 的邮箱，去重后发送；不抄送其他内部用户。
- 所有地址在发送前去重、去空、格式校验。
- 测试发信仅允许管理员操作，且记录在邮件日志。

### 7.4 失败处理与日志

- 发送结果写入 `mail_log`：`PENDING → SENT / FAILED`，记录错误信息、尝试次数、关联业务。
- 询问邮件部分失败不回滚询价开放；供应商列表中显示「发送失败」并提供重发。
- 管理员可在「系统设置 → 邮件日志」查看失败记录并手动重试。
- 重置密码与账号开通邮件发送失败时，接口返回明确提示，便于管理员改用其他方式通知。

### 7.5 安全

- 邮件中的链接使用 `APP_URL` 拼接，不接受外部传入域名，避免开放重定向。
- 重置密码令牌只出现在链接中，日志中需脱敏。
- HTML 模板对用户输入（项目名称、备注等）做转义，防止邮件内容注入。

---

## 8. 前端页面设计

### 8.1 信息架构

```mermaid
flowchart TD
    LOGIN["登录入口"] --> INT["内部端"]
    LOGIN --> SUP["供应商端"]

    INT --> D["工作台 /dashboard"]
    INT --> P["项目 /projects"]
    INT --> S["供应商 /suppliers"]
    INT --> A["用户管理 /admin/users（管理员）"]
    INT --> SET["系统设置 /admin/settings（管理员）"]
    INT --> ME["个人中心 /account"]

    P --> P1["新建项目 /projects/new"]
    P --> P2["项目详情 /projects/:id"]
    P2 --> P3["新增询价项 /projects/:id/inquiries/new"]
    P2 --> P4["询价项详情与报价对比 /projects/:id/inquiries/:inquiryId"]
    P2 --> P5["订单详情 /orders/:id"]

    S --> S1["新建供应商 /suppliers/new"]
    S --> S2["供应商详情 /suppliers/:id"]

    SUP --> SD["工作台 /supplier/dashboard"]
    SUP --> SI["询价 /supplier/inquiries"]
    SUP --> SH["我的报价历史 /supplier/quote-history"]
    SUP --> SO["订单 /supplier/orders"]
    SUP --> SME["账号 /supplier/account"]

    SI --> SI1["询价详情与报价 /supplier/inquiries/:id"]
    SO --> SO1["订单详情（合同/验收/发票） /supplier/orders/:id"]
```

### 8.2 页面清单

| 编号 | 页面 | 路由 | 角色 | 优先级 |
| --- | --- | --- | --- | --- |
| P-01 | 内部登录 | `/login` | 公开 | P0 |
| P-02 | 内部找回密码 | `/forgot-password` | 公开 | P0 |
| P-03 | 内部重置密码 | `/reset-password` | 公开 | P0 |
| P-04 | 供应商登录 | `/supplier/login` | 公开 | P0 |
| P-05 | 供应商找回/重置密码 | `/supplier/forgot-password`、`/supplier/reset-password` | 公开 | P0 |
| P-06 | 首次登录强制改密 | `/change-password`、`/supplier/change-password` | 内部/供应商 | P0 |
| I-01 | 内部工作台 | `/dashboard` | 内部 | P0 |
| I-02 | 项目列表 | `/projects` | 内部 | P0 |
| I-03 | 新建项目 | `/projects/new` | 内部 | P0 |
| I-04 | 项目详情 | `/projects/[projectId]` | 内部 | P0 |
| I-05 | 新增询价项 | `/projects/[projectId]/inquiries/new` | 内部 | P0 |
| I-06 | 询价项详情与报价对比 | `/projects/[projectId]/inquiries/[inquiryId]` | 内部 | P0 |
| I-07 | 供应商列表 | `/suppliers` | 内部 | P0 |
| I-08 | 新建/编辑供应商 | `/suppliers/new`、`/suppliers/[supplierId]/edit` | 内部 | P0 |
| I-09 | 供应商详情 | `/suppliers/[supplierId]` | 内部（可见范围内） | P0 |
| I-10 | 内部用户管理 | `/admin/users` | 管理员 | P1 |
| I-11 | 系统设置 | `/admin/settings` | 管理员 | P1 |
| I-12 | 个人中心 | `/account` | 内部 | P1 |
| I-13 | 内部订单详情（合同/验收/发票） | `/orders/[orderId]` | 内部（创建者/管理员可操作） | P0 |
| S-01 | 供应商工作台 | `/supplier/dashboard` | 供应商 | P0 |
| S-02 | 供应商询价列表 | `/supplier/inquiries` | 供应商 | P0 |
| S-03 | 询价详情与报价 | `/supplier/inquiries/[inquiryId]` | 供应商 | P0 |
| S-04 | 供应商订单列表 | `/supplier/orders` | 供应商 | P0 |
| S-05 | 订单详情（合同/验收/发票） | `/supplier/orders/[orderId]` | 供应商 | P0 |
| S-06 | 供应商账号 | `/supplier/account` | 供应商 | P1 |
| S-07 | 我的报价历史 | `/supplier/quote-history` | 供应商 | P1 |

**路由守卫与跳转**

| 场景 | 行为 |
| --- | --- |
| 未登录访问内部页面 | 跳转 `/login?redirect={当前路径}` |
| 未登录访问供应商页面 | 跳转 `/supplier/login?redirect={当前路径}` |
| 已登录访问对应登录/找回密码页 | 直接跳转对应工作台 |
| 内部会话访问 `/supplier/*` | 跳转 `/forbidden`，提示使用供应商账号登录 |
| 供应商会话访问内部页面或 `/api/*` 内部接口 | 跳转 `/forbidden` / 返回 403 |
| 非管理员访问 `/admin/*` | 跳转 `/forbidden` |
| 会话 `mustChangePassword=true` | 强制跳转 `/change-password` 或 `/supplier/change-password`，后端仅放行改密相关接口 |
| 访问不存在的项目/询价/订单 | 展示 404 页面，不泄露资源是否存在 |
| 打开已归档项目 | 可查看，所有写操作隐藏并被服务端拒绝 |

登录成功后优先回跳 `redirect`，无该参数时内部端进入 `/dashboard`，供应商端进入 `/supplier/dashboard`。

### 8.3 全局设计规范

**视觉风格**

- 以 HeroUI v3 默认主题为基础，主色使用蓝色系（品牌、主按钮、链接）；中性色使用 zinc 系列。
- 页面背景 `zinc-50`，内容卡片白色、圆角 `rounded-2xl`、细边框、轻阴影；避免大面积高饱和色。
- 中文正文使用系统字体栈（PingFang SC / Microsoft YaHei / Noto Sans SC），数字与金额使用等宽数字（`tabular-nums`）。
- 图标统一使用一套线性图标库（如 lucide-react），禁止混用多种风格。

**布局**

- 内部端：左侧固定侧边栏（宽 240px）+ 顶部栏（64px）+ 内容区；内容最大宽度 1440px，左右留白 24–32px。
- 供应商端：顶部导航（工作台 / 询价 / 订单 / 账号）+ 内容区，减少层级，突出待办。
- 详情页统一结构：面包屑 → 标题行（标题 + 状态 + 主操作）→ 信息摘要 → Tabs/内容区。
- 所有页面标题使用同一个 `PageHeader` 组件，保证间距、字号、操作区位置一致。

**响应式**

| 断点 | 行为 |
| --- | --- |
| `< 640px` | 单列；表格转卡片；筛选项折叠到 Drawer；主操作固定底部或标题行换行 |
| `640–1024px` | 侧边栏收起为图标栏或抽屉；表格可横向滚动 |
| `≥ 1024px` | 完整侧边栏 + 多列表格；详情页左右分栏（主内容 + 侧栏摘要） |

**状态规范**

- 加载：使用与页面结构一致的 `Skeleton`，禁止整页空白转圈。
- 空状态：图标 + 一句解释 + 主操作按钮（如「新建项目」）；筛选无结果时提供「清空筛选」。
- 错误：卡片内展示错误摘要与「重试」，保留筛选条件。
- 无权限：跳转 `/forbidden` 或在页面内展示无权限说明，不泄露资源存在性。
- 操作反馈：成功后 `Toast` 提示并刷新相关查询；危险操作（关闭询价、选标、停用账号）必须二次确认。
- 轮询：工作台与询价详情每 30 秒刷新一次，页面失焦时暂停。

**表单规范**

- 统一使用 `react-hook-form` + `zod`；字段标签在上方，必填加 `*`，错误信息在字段下方。
- 提交按钮进入 loading 且禁用，防重复提交；成功后重置或跳转。
- 金额、数量使用 `NumberField`；日期时间使用 `DatePicker` + `TimeField`，并明确时区。
- 离开有未保存内容的页面时提示确认（可选增强）。

**表格规范**

- 服务端分页与排序；筛选条件同步到 URL query，便于刷新与分享。
- 列过多时优先保留：名称/编号、关键状态、时间、操作；次要信息进详情。
- 行操作不超过 3 个，更多操作放入 `Dropdown`。
- 移动端转换为卡片列表，卡片内保留标题、状态、关键字段与主操作。

**状态色映射**

| 业务状态 | 颜色 |
| --- | --- |
| 草稿 / 已取消 / 已停用 | 中性灰 |
| 开放中 / 进行中 | 蓝色 |
| 即将截止（<3 天） | 琥珀色 |
| 已关闭 / 待处理 | 橙色 |
| 已选标 / 已回传 | 紫色 |
| 已完成 / 已确认 | 绿色 |
| 失败 / 驳回 | 红色 |

### 8.4 公共页面

#### P-01 内部登录 `/login`

- **布局**：桌面端左右分栏（左侧品牌与平台介绍、右侧登录卡片）；移动端仅保留登录卡片。
- **区块**：平台 Logo/名称、登录表单、「忘记密码」链接、底部「供应商登录 →」入口。
- **字段**：账号（占位「用户名或邮箱」）、密码、显示密码切换；「记住我」可选。
- **交互**：提交时按钮 loading；失败在表单顶部展示 `Alert`；成功后跳转 `redirect` 或 `/dashboard`；已登录访问时自动跳转工作台。
- **接口**：`POST /api/auth/internal/sign-in/email` 或 `/sign-in/username`。
- **异常**：账号停用提示联系管理员；网络错误可重试。

#### P-02 内部找回密码 `/forgot-password`

- 邮箱输入 + 提交；提交后统一展示「如果该邮箱存在，我们已发送重置邮件」。
- 提供返回登录链接；60 秒内禁止重复提交（按钮倒计时）。

#### P-03 内部重置密码 `/reset-password`

- 从 query 读取 `token`；无效/过期时展示错误卡片与「重新申请」入口。
- 字段：新密码、确认密码；实时展示密码规则；成功后跳转登录并提示。
- 接口：Better Auth 重置密码接口。

#### P-04 供应商登录 `/supplier/login`

- 结构与内部登录一致，品牌文案改为供应商视角（「查看询价、提交报价与合同」）。
- 底部提供「内部用户登录 →」；登录成功后跳转 `/supplier/dashboard`。
- 接口：`/api/auth/supplier/*`；内部账号无法登录供应商端，反之亦然。

#### P-05 供应商找回/重置密码

- 复用内部端组件，仅替换文案、接口前缀与跳转路由。

#### P-06 首次登录强制改密 `/change-password`、`/supplier/change-password`

- **触发**：登录成功后会话返回 `mustChangePassword=true`，或业务接口返回 `403 PASSWORD_CHANGE_REQUIRED`。
- **布局**：居中卡片，隐藏主导航，避免用户绕过；标题「请先修改初始密码」。
- **字段**：新密码、确认密码；展示密码规则与强度提示。
- **交互**：不提供「跳过」；提交成功后 `mustChangePassword=false`，跳转对应工作台并 Toast 提示。
- **接口**：`POST /api/auth/internal/change-password` 或 `/api/auth/supplier/change-password`；改密成功后后端更新标记。
- **异常**：新密码与初始密码相同则拒绝；失败保留表单并提示。

### 8.5 内部端页面

#### I-01 内部工作台 `/dashboard`

```
┌────────────────────────────────────────────────────────────┐
│ 早上好，张三                               [新建项目] [新建供应商] │
│ 今天是 2026-11-23，有 3 项待办需要处理                        │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ 进行中项目 │ 开放中询价 │ 待选标    │ 待审合同  │ 待处理发票/请款   │
│    12    │    8     │    3     │    2     │       1         │
├───────────────────────────────┬────────────────────────────┤
│ 我的待办                       │ 即将截止的询价               │
│ · 询价「XX 物料」已关闭待选标   │ · XX 项目 / 24 小时后截止    │
│ · 订单 ORD-... 合同待审核       │ · ...                      │
├───────────────────────────────┴────────────────────────────┤
│ 最近项目（表格：编号/名称/负责人/询价数/状态/更新时间/操作）      │
└────────────────────────────────────────────────────────────┘
```

- **数据**：KPI、待办、最近项目、即将截止询价；一次请求 `GET /api/dashboard`。
- **交互**：KPI 卡片可点击，跳转对应列表并携带筛选条件；待办项直接进入详情；倒计时小于 24 小时标红。
- **权限**：所有内部用户可访问；待办范围按「创建者 + 管理员」与可见供应商计算。
- **空状态**：无待办时展示「当前没有待处理事项」并推荐新建项目。

#### I-02 项目列表 `/projects`

- **标题行**：标题「项目」+ 数量、「新建项目」按钮。
- **筛选**：关键词（名称/编号）、状态（进行中/已归档）、负责人、创建时间范围；「重置」。
- **表格列**：项目编号、项目名称、客户、询价项数、负责人、状态、最近更新、操作（查看）。
- **交互**：行点击进入详情；筛选同步 URL；分页 20 条/页；新建后回到列表并高亮新项目（可选）。
- **接口**：`GET /api/projects`。
- **响应式**：移动端卡片显示名称、状态、询价项数、负责人与更新时间。

#### I-03 新建项目 `/projects/new`

- **布局**：左侧主表单（约 2/3），右侧说明卡片（询价流程提示、默认 15 天期限说明）。
- **项目信息**：项目名称*、项目编号（默认自动生成，可修改）、客户名称、项目描述、联系人姓名*、联系人邮箱*、联系人电话*。
- **默认询价项**（随项目一起创建）：
  - 询价项标题*、询价要求/规格描述、数量*、单位*、截止时间*（默认当前 +15 天）；
  - 受邀供应商*（多选，显示评级与可见范围；支持搜索；至少选择 1 个才能发送）；
  - 询价附件（可选）。
- **底部操作**：「保存草稿」创建项目 + DRAFT 询价项并进入详情；「创建并发送询价」创建后立即发送邮件（需通过完整校验）。
- **校验**：联系人邮箱格式、截止时间晚于当前、数量 > 0、发送时供应商 ≥ 1。
- **接口**：`POST /api/projects`，随后 `POST /api/inquiries/:id/send`（发送场景）。
- **异常**：创建成功但发信部分失败时，进入详情并提示「部分邮件发送失败，可重发」。

#### I-04 项目详情 `/projects/[projectId]`

```
┌────────────────────────────────────────────────────────────┐
│ 项目 / PRJ-2026-001                                     [编辑] │
│ XX 产线设备采购                        [进行中]   [归档]        │
├────────────────────────────────────────────────────────────┤
│ 客户：XX 公司 | 负责人：张三 | 联系人：李四 138... | 创建于 ... │
├────────────────────────────────────────────────────────────┤
│ [询价项 3] [订单与合同 1] [发票与请款 2] [动态]                  │
│ ┌ 询价项卡片 ─────────────────────────────────────────────┐ │
│ │ 标题  [开放中]  截止 2026-12-08 18:00（剩 15 天）        │ │
│ │ 受邀 5 家 · 已报价 3 家           [查看详情] [关闭]       │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- **标题行**：面包屑、项目名称 + 编号、状态 Chip、编辑/归档（有权限时显示）。
- **摘要卡**：客户、负责人、联系人（电话/邮箱可点击复制）、创建时间、项目描述（折叠长文本）。
- **Tabs**：
  - 询价项：卡片列表，显示状态、截止倒计时、受邀/已报价数量、快捷操作（查看、关闭、重新开放、发送）；
  - 订单与合同：订单表格（订单号、供应商、金额、订单状态、合同状态、验收单状态、发票数、操作），行操作进入 I-13；
  - 发票与请款：按订单聚合的发票记录表（供应商、发票号、金额、提交时间、查看）；
  - 动态：时间线，聚合询价开放、报价提交、选标、合同往来、验收单、发票提交与邮件发送记录。
- **交互**：「新增询价项」进入 I-05；归档需确认；Tabs 状态写入 URL（`?tab=orders`）；订单行跳转 `/orders/[orderId]`。
- **接口**：`GET /api/projects/:id`、`GET /api/orders?projectId=`。
- **响应式**：Tabs 横向可滚动；卡片单列。

#### I-05 新增询价项 `/projects/[projectId]/inquiries/new`

- 与 I-03 的「默认询价项」字段一致，额外显示所属项目只读摘要。
- 支持「保存草稿」与「保存并发送」；发送前弹出确认框，列出受邀供应商数量与截止时间。
- 成功后返回项目详情并定位到新询价项；接口 `POST /api/projects/:projectId/inquiries`、`POST /api/inquiries/:id/send`。

#### I-06 询价项详情与报价对比 `/projects/[projectId]/inquiries/[inquiryId]`

```
┌────────────────────────────────────────────────────────────┐
│ 询价项：XX 物料采购          [已关闭]                        │
│ 截止 2026-11-20 18:00 · 受邀 5 家 · 已报价 3 家               │
│ 操作：[重新开放] [作废] [选定供应商]                            │
├───────────────────────────────┬────────────────────────────┤
│ 询价要求 / 数量 / 单位 / 附件    │ 内部联系人：李四 138...      │
├───────────────────────────────┴────────────────────────────┤
│ 报价对比                                                     │
│ 供应商   单价     总价     交期  有效期   附件  综合分  操作   │
│ A 公司   ¥120    ¥12,000   7天   30天    📎    4.6   [选定]  │
│ B 公司   ¥118    ¥11,800  10天   15天    📎    4.2   [选定]  │
├────────────────────────────────────────────────────────────┤
│ 受邀供应商与邮件状态（已发送/失败，可重发）                     │
└────────────────────────────────────────────────────────────┘
```

- **标题行**：询价项标题、状态、截止时间与倒计时、受邀/已报价统计；操作按状态与权限显示。
- **信息区**：询价要求、数量单位、截止时间、附件下载、项目与内部联系人信息。
- **报价对比表**：按供应商展示单价、总价、交期、有效期、附件、综合分、提交时间、版本；支持按总价/交期/评级排序；自动高亮最低总价与最短交期；点击行打开报价详情 Drawer（含补充说明、附件、评分入口）。
- **导出**：「导出对比表」调用 `GET /api/inquiries/:id/quotes/export?format=xlsx`，下载 Excel；导出内容包含项目、询价项、供应商、报价字段与提交时间。
- **选标**：仅 `CLOSED` 且有报价时可点「选定」；确认弹窗展示供应商、金额、将生成的订单号规则与「生成后不可重复选标」提示；成功后跳转订单详情 `/orders/[orderId]`。
- **重新开放**：弹窗设置新截止时间（默认 +15 天），可选「重新发送询价邮件」。
- **邮件状态**：受邀供应商表格展示发送状态与失败原因，支持单条重发。
- **接口**：`GET /api/inquiries/:id`、`GET /api/inquiries/:id/quotes`、`GET /api/inquiries/:id/quotes/export`、`POST /api/inquiries/:id/award`、`/close`、`/reopen`、`/cancel`、`/resend`。
- **响应式**：对比表在移动端转为按供应商的卡片，突出总价与「选定」按钮。

---

#### I-07 供应商列表 `/suppliers`

- **标题行**：标题「供应商」+ 数量、「新建供应商」。
- **筛选**：关键词（名称/编码）、评级区间（如 ≥4 分）、可见范围（全员/指定）、状态（合作中/已停用）。
- **表格列**：供应商名称/编码、主营类别、综合评级（星级 + 分数 + 评价数）、账号数、可见范围、合作中询价/订单数、状态、操作（查看）。
- **交互**：行点击进入详情；评级列支持按分数排序；移动端改为卡片（名称、评级、状态、合作数）。
- **接口**：`GET /api/suppliers`。
- **权限**：只返回当前用户可见的供应商；无权限的供应商不出现在列表与搜索中。

#### I-08 新建/编辑供应商 `/suppliers/new`、`/suppliers/[supplierId]/edit`

- **布局**：左侧主表单，右侧说明卡（可见范围说明、账号说明）。
- **企业信息**：供应商名称*、编码（自动生成/可改）、简称、主营类别、地址、官网、税号、备注。
- **可见范围**：`全员` / `指定用户`；选择指定用户时使用内部用户多选（搜索姓名/邮箱），创建者与管理员始终可见并置灰展示。
- **首个账号（仅新建时可选）**：姓名*、用户名*、邮箱*、手机、职位；系统自动生成一次性初始密码（仅展示一次），通过邮件发送登录信息，首次登录强制改密。
- **校验**：名称唯一性（软提示）、邮箱/用户名格式、指定用户至少 1 人。
- **操作**：保存后进入供应商详情；创建账号失败不回滚供应商，提示可在详情页重试。
- **接口**：`POST /api/suppliers`、`PATCH /api/suppliers/:id`、`PATCH /api/suppliers/:id/visibility`。

#### I-09 供应商详情 `/suppliers/[supplierId]`

```
┌────────────────────────────────────────────────────────────┐
│ 供应商 / 华东机电有限公司   [合作中]  ★ 4.5（12 条评价）       │
│                                     [编辑] [新建账号]         │
├────────────────────────────────────────────────────────────┤
│ 主营：机电设备 | 可见范围：指定 3 人 | 创建人：张三 | 税号：... │
├────────────────────────────────────────────────────────────┤
│ [账号 3] [评级] [合作记录] [可见范围]                         │
│ 账号表：姓名/用户名/邮箱/手机/职位/状态/最近登录/操作           │
│ 操作：编辑 · 重置密码 · 停用                                   │
└────────────────────────────────────────────────────────────┘
```

- **标题行**：名称、状态、综合评级、编辑与新建账号按钮（管理员/创建者）。
- **概览**：企业信息、可见范围摘要、创建人、创建时间；长文本折叠。
- **账号 Tab**：账号列表与状态；创建账号弹窗（姓名/用户名/邮箱/手机/职位），系统生成一次性初始密码并发送邮件；重置密码、停用/启用；停用需确认。
- **评级 Tab**：三维均分（进度条或星级）、综合分、评价历史（评价人、询价、三维分数、评论、时间）；「评价」按钮打开评分弹窗，选择关联询价（仅已报价/已选标的询价可选）。
- **合作记录 Tab**：该供应商参与过的询价（状态、报价金额、是否中标）与订单（订单号、金额、状态），点击跳转项目/订单。
- **可见范围 Tab**：当前范围与用户列表；修改走弹窗，保存后立即生效。
- **接口**：`GET /api/suppliers/:id`、账号相关接口、`GET/POST /api/suppliers/:id/ratings`。

#### I-10 内部用户管理 `/admin/users`

- **权限**：仅管理员；非管理员访问跳转 `/forbidden`。
- **列表**：姓名、用户名、邮箱、角色、状态、最近登录、创建时间、操作。
- **筛选**：关键词、角色、状态；分页。
- **新建/编辑弹窗**：姓名*、用户名*、邮箱*、手机、角色（管理员/普通用户）；系统生成一次性初始密码并发送邮件，首次登录强制改密；编辑不修改密码。
- **操作**：编辑、重置密码（发送邮件）、停用/启用；禁止停用自己与最后一个管理员，确认弹窗说明影响。
- **接口**：`GET/POST /api/admin/users`、`PATCH /api/admin/users/:id`、`POST .../reset-password`、`POST .../status`。

#### I-11 系统设置 `/admin/settings`

- **权限**：仅管理员。
- **平台信息**：平台名称、平台访问地址（用于邮件链接）、默认联系人姓名/电话/邮箱；保存后立即生效。
- **邮件配置**：展示 SMTP 连接状态、发件人（来自环境变量，页面只读）、测试发信表单（收件人 + 发送）。
- **邮件日志**：表格展示模板、收件人、状态、错误信息、时间、关联业务；失败记录提供「重试」。
- **操作日志**：表格展示时间、操作人、动作、目标、摘要、IP；支持按操作人/动作/时间筛选（数据来自 `audit_log`）。
- **说明**：SMTP 账号密码不落库、不在页面展示，修改需调整环境变量并重启服务。
- **接口**：`GET/PUT /api/admin/settings`、`POST /api/admin/mail/test`、`GET /api/admin/mail-logs`、`GET /api/admin/audit-logs`。

#### I-12 个人中心 `/account`

- **资料**：姓名、邮箱（只读）、用户名（只读）、手机；保存后刷新会话信息。
- **安全**：修改密码（当前密码/新密码/确认密码）；首次登录强制改密时仅展示改密卡片；退出登录。
- **接口**：`GET/PATCH /api/me`，改密走 Better Auth。
- **响应式**：单列卡片，移动端全宽。

#### I-13 内部订单详情（合同/验收/发票） `/orders/[orderId]`

```
┌────────────────────────────────────────────────────────────┐
│ 订单 ORD-20261123-0001        [进行中] 合同：已回传 验收：已签署 │
│ 项目：XX 产线设备采购 | 供应商：华东机电 | 金额：¥12,000.00     │
│ 操作：[标记完成] [取消订单]                                    │
├────────────────────────────────────────────────────────────┤
│ [订单信息] [合同] [验收单] [发票与请款]                        │
├────────────────────────────────────────────────────────────┤
│ 合同：状态进度 + 文件版本 + [回传修订版]                       │
│ 验收单：供应商上传 → 内部签署；[下载] [签署]                   │
│ 发票：提交记录（只读，本期不审核）                             │
└────────────────────────────────────────────────────────────┘
```

- **头部**：订单号、项目/询价项、供应商、金额、订单状态、合同状态、验收单状态；操作按钮按权限与状态显示。
- **订单信息 Tab**：项目、询价项、中标报价摘要、内部联系人、订单时间线。
- **合同 Tab**：合同状态、供应商上传版本、内部回传版本，均可下载；`SUBMITTED` 时可上传修订版并回传（确认后邮件通知供应商）。
- **验收单 Tab**：未上传时展示「供应商尚未上传（可选）」；已上传时可下载并「签署」（上传签署版或标记已签署）；签署后展示签署人、时间与文件。
- **发票与请款 Tab**：提交记录与附件，只读；无审核/驳回操作；提示本期不做财务审核。
- **完成/取消**：仅项目创建者或管理员可操作；标记完成需确认，完成后禁止新的合同/验收单/发票提交，但历史记录保留。
- **接口**：`GET /api/orders/:id`、`POST /api/orders/:id/complete`、`/cancel`、`POST /api/orders/:id/contract/return`、`POST /api/orders/:id/acceptance/sign`。
- **响应式**：Tabs 横向滚动；文件与操作按钮在移动端纵向排列。

### 8.6 供应商端页面

#### S-01 供应商工作台 `/supplier/dashboard`

```
┌────────────────────────────────────────────────────────────┐
│ 华东机电有限公司 · 王五                        [查看询价]      │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ 待报价 2      │ 已报价 3      │ 待提交合同 1  │ 进行中订单 2   │
├──────────────────────────────┬─────────────────────────────┤
│ 即将截止                     │ 待办                         │
│ · XX 物料 · 24 小时后截止     │ · 订单 ORD-... 请提交合同     │
│ · ...                        │ · ...                       │
├──────────────────────────────┴─────────────────────────────┤
│ 最近询价 / 最近订单                                           │
└────────────────────────────────────────────────────────────┘
```

- **数据**：待报价、已报价、待提交合同、进行中订单数量；即将截止询价；待办；最近询价与订单。
- **交互**：卡片跳转对应列表；合同待办直达订单详情合同区。
- **接口**：`GET /api/supplier/dashboard`。
- **空状态**：无待办时展示「暂无待处理事项」，并提示留意邮件通知。

#### S-02 供应商询价列表 `/supplier/inquiries`

- **范围**：开放列表仅展示被邀请且状态为 `OPEN` 的询价项；已关闭/已选标的询价可通过「我的报价历史」只读查看。
- **Tabs**：待报价 / 已报价（均已开放）；右上角提供「我的报价历史」入口。
- **筛选**：关键词（项目/询价项）、截止时间排序。
- **列表列/卡片**：项目名称、询价项标题、数量/单位、截止时间（倒计时）、状态（待报价/已报价/即将截止）、操作（查看/报价/修改报价）。
- **交互**：点击进入 S-03；即将截止（<3 天）用琥珀色提示；移动端卡片。
- **接口**：`GET /api/supplier/inquiries`、`GET /api/supplier/quote-history`。
- **空状态**：说明「暂无可参与的询价，新的询价会通过邮件通知」。

#### S-03 询价详情与报价 `/supplier/inquiries/[inquiryId]`

```
┌────────────────────────────────────────────────────────────┐
│ 询价项：XX 物料采购                     [待报价] 截止 2 天后  │
│ 项目：XX 产线设备采购                                         │
├───────────────────────────────┬────────────────────────────┤
│ 询价要求 / 数量 / 单位 / 附件   │ 联系人：李四 138... / 邮箱   │
├───────────────────────────────┴────────────────────────────┤
│ 我的报价                                                     │
│ 单价* [      ] 总价* [      ] 币种 [CNY] 交期 [  ] 天        │
│ 有效期至* [日期] 补充说明 [多行文本]                          │
│ 报价文件* [上传 PDF/Excel/Word，可多个]                       │
│ [提交报价]  （已提交过则显示「修改报价」与版本信息）            │
└────────────────────────────────────────────────────────────┘
```

- **头部**：询价项标题、项目名称、状态、截止倒计时；关闭或未受邀时展示不可用说明。
- **历史只读模式**：从「我的报价历史」进入已关闭/已选标询价时，展示询价信息与自己的报价、附件，不显示报价表单，并提示「询价已关闭」。
- **信息区**：询价要求、数量单位、询价附件下载、内部联系人卡片（姓名/电话/邮箱，说明「如有疑问，请联系 XXX」）。
- **报价表单**：单价*、总价*（默认单价 × 数量，可改）、币种、交期（天）、有效期至*、补充说明、报价文件*（多文件）。
- **已报价状态**：回显当前报价与版本号、提交时间；允许截止前修改，点击「修改报价」进入编辑；提交时确认「将再次通知采购方」。
- **校验**：单价/总价 > 0、有效期不早于今天、至少 1 个附件、截止时间未过（服务端兜底）。
- **反馈**：成功 Toast「报价已提交」，状态变为已报价；失败保留表单内容并展示错误。
- **接口**：`GET /api/supplier/inquiries/:id`、`PUT /api/supplier/inquiries/:id/quote`、`POST /api/files`。
- **响应式**：单列，提交按钮移动端固定在底部；附件列表纵向排列。

#### S-04 供应商订单列表 `/supplier/orders`

- **列表列/卡片**：订单号、项目/询价项、金额、订单状态、合同状态、验收单状态、发票提交次数、创建时间、操作（查看）。
- **筛选**：关键词、订单状态、合同状态；分页。
- **交互**：进入 S-05；合同状态为「待提交」时高亮并提供快捷入口。
- **接口**：`GET /api/supplier/orders`。
- **空状态**：说明「暂无订单，选定结果会通过邮件通知」。

#### S-05 订单详情（合同/验收/发票） `/supplier/orders/[orderId]`

```
┌────────────────────────────────────────────────────────────┐
│ 订单 ORD-20261123-0001       [进行中] 合同：已回传 验收：已上传 │
│ 项目：XX 产线设备采购 | 金额：¥12,000.00                      │
├────────────────────────────────────────────────────────────┤
│ [订单信息] [合同] [验收单] [发票与请款]                        │
├────────────────────────────────────────────────────────────┤
│ 合同进度：待提交 → 已提交 → 已回传 → 线下签署                  │
│ 供应商上传：合同_v1.pdf  查看 | 内部回传：合同_修订.pdf 查看    │
│ （待提交时）[上传合同] 备注 [......]                          │
├────────────────────────────────────────────────────────────┤
│ 验收单（可选）                                                │
│ 上传：验收单.pdf | 内部签署：验收单_签署版.pdf                 │
│ （订单未完成且未签署）[上传验收单]                             │
├────────────────────────────────────────────────────────────┤
│ 发票与请款                                                   │
│ 记录表：发票号/金额/提交时间/附件/查看                         │
│ （订单未完成）[提交发票与请款]                                │
└────────────────────────────────────────────────────────────┘
```

- **头部**：订单号、项目与询价项、订单金额、订单状态、合同状态、验收单状态；返回列表。
- **订单信息 Tab**：项目信息、询价项、报价摘要（单价/总价/交期）、内部联系人、订单时间线。
- **合同 Tab**：
  - 状态进度条与时间线；
  - 文件列表：供应商上传版本、内部回传修订版，均可下载；
  - `PENDING_SUBMISSION` 或 `SUBMITTED` 且未被回传时显示上传表单（合同文件*、备注），提交后状态更新并邮件通知内部；
  - `RETURNED` 后只读，提示「请按修订版线下签署」。
- **验收单 Tab（可选）**：
  - 未上传且订单未完成时提供「上传验收单」（PDF/图片 + 备注）；
  - 已上传未签署时展示文件与「等待内部签署」；
  - 已签署时展示签署版文件、签署时间，不可再修改；
  - 订单完成后按钮禁用，仅可查看历史文件。
- **发票与请款 Tab**：
  - 历史记录表：发票号、金额、提交时间、发票/请款书附件（只读，本期无审核状态）；
  - 订单未 `COMPLETED/CANCELLED` 时显示「提交发票与请款」按钮；
  - 弹窗字段：发票号*、金额*（默认订单金额）、发票文件*、请款书文件*、备注；提交后邮件通知内部并刷新列表。
- **接口**：`GET /api/supplier/orders/:id`、`POST /api/supplier/orders/:id/contract`、`POST /api/supplier/orders/:id/acceptance`、`POST /api/supplier/orders/:id/invoices`、`POST /api/files`。
- **异常**：订单已完成时合同/验收单/发票提交按钮禁用并提示原因；文件上传失败可单独重试。

#### S-06 供应商账号 `/supplier/account`

- 展示所属企业信息（只读）：企业名称、编码、主营、地址。
- 可编辑个人信息：姓名、手机、职位；用户名/邮箱只读（邮箱变更需联系内部管理员）。
- 修改密码、退出登录。
- **接口**：`GET/PATCH /api/supplier/me`。

#### S-07 我的报价历史 `/supplier/quote-history`

- **目标**：询价关闭/选标后，供应商仍能回看自己提交过的报价，不必依赖邮件查找。
- **范围**：仅自己提交过报价的询价项（含 `CLOSED / AWARDED`），不含未受邀或未报价的询价。
- **列表列/卡片**：项目名称、询价项标题、报价版本、总价、交期、提交时间、询价状态、操作（查看）。
- **交互**：点击进入 S-03 的只读模式；支持按提交时间/状态筛选，分页；移动端卡片。
- **接口**：`GET /api/supplier/quote-history`、`GET /api/supplier/inquiries/:id`（历史只读）。
- **空状态**：说明「暂无历史报价，提交报价后会显示在这里」。
- **权限**：只返回当前账号所属供应商的数据，禁止通过参数查看其他供应商报价。

### 8.7 通用弹窗与共享组件

| 组件 | 使用页面 | 关键点 |
| --- | --- | --- |
| `ConfirmDialog` | 关闭询价、选标、作废、停用账号、完成订单、签署验收单 | 标题、影响说明、危险操作红色确认按钮、loading |
| `SupplierPicker` | 新建项目/询价项 | 远程搜索、多选、展示评级与可见范围、已选标签 |
| `UserPicker` | 供应商可见范围 | 内部用户搜索、多选、创建者/管理员置灰 |
| `FileUpload` | 询价附件、报价、合同、验收单、发票 | 拖拽/选择、类型与大小校验、进度、删除、失败重试 |
| `AcceptancePanel` | 内部/供应商订单详情 | 验收单上传、签署、文件版本与状态展示 |
| `QuoteDrawer` | 询价项详情 | 报价明细、补充说明、附件、评级入口 |
| `RatingModal` | 供应商详情、报价 Drawer | 三维评分 + 评论，关联询价选择 |
| `StatusChip` | 全局 | 统一状态色与中文文案映射 |
| `CountdownText` | 询价列表/详情 | 天/小时/分钟展示，<24h 红色，<3d 琥珀色 |
| `EmptyState` | 全局 | 图标 + 说明 + 主操作 |
| `PageHeader` | 全局 | 标题、状态、主/次操作、面包屑 |
| `DataTable` | 全局 | 排序、分页、空状态、加载骨架、移动端卡片插槽 |

---

## 9. 非功能设计

### 9.1 安全

- **认证**：Better Auth 双实例，HttpOnly + SameSite Cookie；生产环境强制 HTTPS；两套 Cookie 前缀隔离。
- **授权**：所有业务接口先鉴权再校验数据归属；供应商接口强制附加 `supplierId`；管理员接口二次校验角色。
- **限流**：登录、找回密码、重置密码、测试发信接口使用 `@nestjs/throttler` 限流（如 5 次/分钟/IP），防止暴力破解与邮件轰炸。
- **密码**：至少 8 位含字母数字；仅存储 Better Auth 哈希；日志与响应中不出现密码、令牌；首次登录一次性密码必须强制修改。
- **上传**：白名单 MIME + 扩展名双重校验、大小限制、文件名清洗、存储目录不可通过静态路由直接访问；下载使用 5 分钟签名 URL + 会话 + 数据权限三重校验。
- **XSS/注入**：React 默认转义；邮件模板对变量转义；Prisma 参数化查询。
- **CSRF**：前后端同源 + SameSite Cookie；写操作不使用 GET；如后续跨域部署，增加 CSRF Token。
- **敏感配置**：SMTP、Auth Secret、数据库连接仅通过环境变量注入；`.env` 不提交；日志脱敏。
- **审计**：关键操作（询价发送/关闭/重开、选标、合同提交/回传、订单完成/取消、验收单签署、账号停用）写入 `audit_log`，包含操作人、时间、目标、前后状态、IP/UA。
- **越权防护**：所有供应商接口强制按会话 `supplierId` 过滤；每个资源 ID 接口都要做归属校验，并在测试中覆盖 IDOR 场景。

### 9.2 性能与容量

- 列表查询全部服务端分页，禁止一次性加载全量数据。
- 为高频筛选字段建立索引（见 5.4）；列表查询只 select 必要字段，避免 N+1（必要时使用 Prisma `include` 精确控制）。
- 报价对比、项目详情使用聚合查询，减少往返次数。
- 前端 TanStack Query 缓存常用数据；工作台与询价详情 30 秒轮询，页面隐藏时暂停。
- 附件采用流式下载，限制并发；大文件不加载进内存。
- MVP 规模假设：内部用户 < 200，供应商 < 5,000，单项目询价项 < 50，单询价受邀供应商 < 100。

### 9.3 可用性与运维

- `GET /api/health` 返回服务与数据库连通状态（可用 `@nestjs/terminus`）。
- 邮件发送失败不影响主流程，日志可查、可重试。
- 数据库建议每日备份；附件目录纳入备份范围。
- 统一异常过滤器输出 `requestId`，便于排查。
- 生产环境关闭 Prisma 查询日志中的敏感参数。

### 9.4 时区与金额

- 服务端统一 UTC 存储；API 返回 ISO 8601；前端按 `Asia/Shanghai` 展示。
- 倒计时以服务端返回的截止时间为准，前端仅做展示。
- 金额以字符串传输与展示，避免浮点误差；数据库使用 `Decimal`。
- 默认币种 CNY，字段保留扩展能力。

---

## 10. 测试方案

### 10.1 后端（Vitest）

| 模块 | 重点用例 |
| --- | --- |
| 认证与守卫 | 内部/供应商会话隔离、停用账号拒绝、首次登录强制改密、跨端访问 403 |
| 供应商 | 可见范围过滤、创建者/管理员权限、账号创建与停用、评级唯一性与聚合 |
| 询价 | 状态迁移合法性、到期自动关闭、发送前置校验、重开逻辑 |
| 报价 | 截止后拒绝、非受邀拒绝、upsert 与版本递增、邮件触发、历史报价只读与数据隔离 |
| 选标/订单 | 重复选标拒绝、订单号生成、合同初始化、订单完成权限、事务一致性 |
| 合同 | 状态迁移、权限、文件版本记录 |
| 验收单 | 可选上传、签署前置校验、重复签署拒绝、订单完成后拒绝 |
| 发票 | 订单完成后拒绝、多次提交、金额校验、无审核状态 |
| 邮件 | 模板渲染、收件人去重、失败日志 |
| 文件 | 类型/大小校验、签名 URL 过期/篡改拒绝、越权下载拒绝 |
| 审计 | 关键操作写入 `audit_log`、操作人/目标/前后状态正确 |
| 越权（IDOR） | 供应商 A 访问供应商 B 的询价/报价/订单/附件均返回 404/403 |

- 使用 `vi.fn()` Mock Prisma、邮件、存储；服务层单测不依赖真实 SMTP。
- 关键流程使用 `supertest` E2E（独立测试库，迁移后跑用例）。

### 10.2 前端（Vitest + Testing Library）

- 表单校验与提交状态（新建项目、报价、合同、验收单、发票）。
- 列表筛选、分页、空状态与错误状态渲染。
- 权限相关按钮显隐（仅展示层）。
- 状态 Chip、倒计时、金额格式化等纯函数。
- 关键页面：登录、首次登录改密、项目详情 Tabs、报价对比（排序/导出）、供应商详情、订单详情（验收单）。

### 10.3 覆盖目标

- 核心服务（询价、报价、订单、合同、验收单、发票、权限、审计）行覆盖率 ≥ 70%。
- 每个 P0 页面至少 1 个渲染/交互测试。
- CI 命令：后端 `pnpm test`、`pnpm test:e2e`；前端 `pnpm test`；构建 `pnpm build`。

---

## 11. 开发计划

| 阶段 | 内容 | 交付物 | 完成标志 |
| --- | --- | --- | --- |
| 0. 基础设施 | docker-compose 本地环境（PostgreSQL + Mailpit）、Prisma/配置/异常/响应包络、Better Auth 双实例、首次登录强制改密、邮件与存储签名下载、前端布局与请求封装 | 可登录的空壳系统 | 一键启动依赖；两端登录、找回密码、强制改密、会话守卫可用；Mailpit 可收到测试邮件 |
| 1. 账号与权限 | 内部用户管理、供应商账号、可见范围、权限矩阵、审计日志基础 | 账号模块 API 与页面 | 管理员可建内部用户；内部用户可建供应商账号；越权被拒 |
| 2. 供应商 | 供应商 CRUD、账号、评级、供应商列表/详情 | 供应商模块完整 | 评级可聚合、可见范围生效 |
| 3. 项目与询价 | 项目、默认询价项、多询价项、邀请供应商、发送邮件、供应商报价、报价对比（排序/高亮/导出） | 询价闭环 | 供应商收到邮件并可报价；内部收到报价通知；可对比导出 |
| 4. 订单与合同 | 选标、订单生成、合同提交/回传、可选验收单上传与签署、状态流转 | 订单合同闭环 | 选标生成订单；合同双向邮件；验收单可选流转 |
| 5. 发票与请款 | 多次提交、订单完成限制、内部只读查看（本期不审核） | 发票模块 | 未完成订单可多次提交；完成后拒绝 |
| 6. 工作台与设置 | 两端工作台、我的报价历史、系统设置、邮件日志、操作日志、细节打磨 | 完整 MVP | 所有 P0 页面可用，P1 页面完成 |
| 7. 质量与文档 | 单测/E2E 补齐、README、Trae 规则与 SKILL、ADR 整理 | 可交付版本 | 测试通过、文档齐全、验收清单通过 |
| 8. MVP 后 | 方案文档拆分到 `docs/architecture.md`、`data-model.md`、`api.md`、`pages.md` | 分册文档 | 主文件保留需求与索引 |

> 阶段之间允许并行，但阶段 3 依赖阶段 1/2 的账号与供应商能力。

---

## 12. 验收标准

### 12.1 账号与权限

- [ ] 内部账号只能由管理员创建；供应商账号可由有权限的内部用户创建。
- [ ] 同一账号可用用户名或邮箱登录；邮箱必填且唯一（各体系内）。
- [ ] 忘记密码可收到邮件并完成重置；停用账号无法登录。
- [ ] 新建账号使用一次性初始密码，首次登录必须修改密码后才能进入系统。
- [ ] 内部与供应商会话隔离；跨端访问返回 403。
- [ ] 供应商可查看被邀请且开放中的询价，以及自己的历史报价（只读）。

### 12.2 供应商管理

- [ ] 一个供应商可创建多个账号，账号绑定唯一供应商。
- [ ] 可见范围「全员/指定用户」在列表、详情、选择器中生效。
- [ ] 管理员可管理全部供应商账号；创建者可管理自己创建的供应商账号。
- [ ] 评级三维打分、综合分与评价次数正确聚合，重复评价为更新。

### 12.3 询价与报价

- [ ] 新建项目自动生成一个询价项；可新增多个询价项。
- [ ] 询价项默认 15 天，可手动关闭、重新开放；到期自动关闭。
- [ ] 一键发送询价邮件，内容包含项目、平台网址、内部联系人及「如有疑问，请联系 XXX」。
- [ ] 供应商提交报价后，内部联系人收到含报价文件与补充说明的邮件。
- [ ] 截止后无法提交；报价修改版本递增并再次通知。
- [ ] 报价对比支持按总价/交期/评级排序、最低价/最短交期高亮，并可导出 Excel。

### 12.4 订单与合同

- [ ] 询价关闭后可选一个供应商生成订单，并邮件通知供应商提交合同。
- [ ] 供应商提交合同后状态更新、内部收到合同邮件。
- [ ] 内部可回传修订版合同，供应商收到邮件并可下载。
- [ ] 同一询价项不可重复选标。
- [ ] 订单由项目创建者或管理员标记完成；其他内部用户不可操作。
- [ ] 验收单为可选流程：供应商可上传，内部可签署；未上传不影响订单完成。

### 12.5 发票与请款

- [ ] 订单未完成时，供应商可多次提交发票与请款书。
- [ ] 提交后内部收到邮件与附件。
- [ ] 订单完成后提交入口禁用且服务端拒绝。
- [ ] 本期内部仅查看发票记录，不提供审核/驳回操作。
- [ ] 本期不包含发票校验、对账、支付证明单（付款申请书）生成功能。

### 12.6 页面与体验

- [ ] 所有 P0 页面在 375px、768px、1440px 下布局可用。
- [ ] 加载、空、错误、无权限状态均有明确展示。
- [ ] 表单校验、提交防重、危险操作二次确认完整。
- [ ] 首次登录强制改密页不可跳过，改密成功后正常进入工作台。

### 12.7 安全与审计

- [ ] 附件下载必须经过签名 URL 校验，篡改或过期链接返回 403。
- [ ] 登录、找回密码、测试发信接口具备限流。
- [ ] 关键操作写入 `audit_log`，管理员可在系统设置查看。
- [ ] 供应商越权访问其他企业的询价/报价/订单/附件均被拒绝。

---

## 13. 工程规范与文档交付

### 13.1 开发规范（延续并补充）

1. 使用 `pnpm` 管理依赖；新增依赖前评估是否可用成熟第三方库实现，避免重复造轮子。
2. 前后端均使用 TypeScript 严格模式；避免 `any`；共享类型在各自项目内定义，接口以 Zod Schema 为单一事实来源。
3. 单文件保持精简，页面、组件、服务、DTO/Schema 分离；超过约 300 行及时拆分。
4. 数据库操作集中在服务层，Controller 只做参数解析与权限编排；跨表写入使用 `prisma.$transaction`。
5. 错误使用统一业务异常（`AppException` + 错误码），禁止把数据库错误直接暴露给前端。
6. 后端 ESM 约定：相对导入带 `.js`；使用 `import.meta.dirname` 替代 `__dirname`。
7. 前端优先 HeroUI v3 复合组件与 Tailwind 工具类；避免内联样式与自定义 CSS 文件膨胀。
8. 提交前运行：后端 `lint` + `test` + `build`；前端 `lint` + `test` + `build`。

### 13.2 文档

- 根目录 `README.md`：项目简介、架构图、目录说明、依赖安装、数据库初始化、启动方式、测试命令、常见问题。
- `supplier-microplatform-nestjs/README.md`：模块说明、环境变量、Prisma 迁移与种子、邮件/存储配置、API 概览。
- `supplier-microplatform-nextjs/README.md`：页面路由、目录结构、环境变量、代理配置、测试方式。
- 可选：`docs/api.md` 或在 Swagger（`@nestjs/swagger`）中提供接口文档。
- **文档拆分后置**：MVP 开发完成后再将本文拆分为 `docs/architecture.md`、`data-model.md`、`api.md`、`pages.md`，主文件保留需求与索引；拆分前以本文为单一事实来源。
- **ADR**：第 15 节为架构决策记录；拆分文档时迁移到 `docs/adr/`，每条决策独立成文件。

### 13.3 Trae 规则与 SKILL

- 根目录 `.trae/rules/`：monorepo 级规则（包管理、目录边界、提交前检查、文档维护）。
- 两个子项目各自 `.trae/rules/`：框架特有规则（Nest 模块/ESM/Zod；Next 16 App Router/HeroUI v3/Tailwind 4）。
- 建议 SKILL：
  - `supplier-platform-dev`：本项目的开发流程、状态机与数据模型速查；
  - `hero-ui-v3`：HeroUI v3 复合组件用法与主题规范；
  - `prisma-workflow`：数据库确保、迁移、种子与回滚流程。
- 项目级规则/SKILL 放各自目录，跨项目规则放主目录。

---

## 14. 设计假设与待确认事项

以下为当前方案的设计假设，若与业务预期不一致，实施前调整：

1. **项目可见性**：所有内部用户可查看全部项目；编辑、关闭、选标、完成订单、签署验收单仅限创建者与管理员。
2. **报价修改**：截止前允许修改报价，版本递增并重复通知内部；截止后不可修改。
3. **询价关闭后的供应商可见性**：开放列表只展示开放中的询价；已关闭/已选标的询价通过「我的报价历史」只读查看（已采纳）。
4. **一个询价项一个订单**：不支持拆单/部分中标；如需要拆单需扩展订单模型。
5. **账号删除**：语义为停用并隐藏，保留历史操作记录；用户名与邮箱仍占用。
6. **评级主体**：任何可见该供应商的内部用户均可评价，评价需关联询价；供应商端不展示评级。
7. **币种**：MVP 仅使用 CNY，保留 `currency` 字段。
8. **附件存储**：MVP 使用本地磁盘；生产若多实例部署需切换对象存储。
9. **邮件发送**：同步发送并记录日志；失败不阻塞业务，可手动重试。
10. **发票相关**：本期仅做提交与查看，不做审核/驳回、发票校验、财务对账与支付证明单（付款申请书）生成；后续按 1.6 的链路演进。
11. **SMTP 配置**：通过环境变量维护，管理页面只展示状态与测试发信，不在数据库存储密码。
12. **两套账号体系**：允许同一邮箱同时存在于内部与供应商体系（两实例隔离）。
13. **订单完成**：由订单所属项目的创建者或管理员手动标记；验收单不阻塞完成。
14. **验收单**：可选材料，供应商上传、内部签署；每个订单最多一条记录。
15. **文档拆分**：MVP 开发完成后再拆分 `docs/*`，当前以本文为单一事实来源。
16. **安全增强**：附件使用短期签名 URL；关键操作写入 `audit_log`；首次登录强制改密。
17. **本地开发环境**：采用 `docker-compose` 提供 PostgreSQL 16 与 Mailpit；本地邮件只进入 Mailpit 收件箱，生产通过环境变量切换真实 SMTP（已采纳，见 ADR-012）。

---

## 15. 架构决策记录（ADR）

> 说明：以下为已采纳的关键决策。MVP 后拆分文档时，每条迁移为 `docs/adr/NNNN-*.md`，记录背景、备选方案、决策与影响。

| ID | 决策 | 状态 | 关键理由 |
| --- | --- | --- | --- |
| ADR-001 | Better Auth 内部/供应商双实例 | 已采纳 | 满足两套账号体系，会话与账号物理隔离 |
| ADR-002 | Prisma `relationMode = "prisma"`，不建数据库外键 | 已采纳 | 符合工程约定，由应用层维护一致性 |
| ADR-003 | 订单状态与合同状态分离 | 已采纳 | 合同多轮往来不污染履约状态 |
| ADR-004 | 报价截止前可修改，版本递增 | 已采纳 | 符合真实询价场景，减少笔误损失 |
| ADR-005 | 供应商开放列表 + 历史报价只读 | 已采纳 | 兼顾需求限制与供应商回看体验 |
| ADR-006 | 验收单为可选流程 | 已采纳 | 满足验收留痕，又不强制阻塞所有订单 |
| ADR-007 | 发票审核移出本期，后续按「发票校验 → 对账 → 支付证明单」演进 | 已采纳 | 控制 MVP 范围，同时保留清晰演进路径（见 1.6） |
| ADR-008 | 订单完成由项目创建者/管理员标记 | 已采纳 | 明确责任人与权限边界 |
| ADR-009 | 附件短期签名 URL + 会话与权限校验 | 已采纳 | 降低附件 ID 枚举与盗链风险 |
| ADR-010 | 关键操作写入 `audit_log` | 已采纳 | 选标、合同、订单、账号操作可追溯 |
| ADR-011 | 文档拆分在 MVP 后实施 | 已采纳 | 避免开发期文档上下文被过早拆散 |
| ADR-012 | 本地开发环境使用 `docker-compose`（PostgreSQL 16 + Mailpit） | 已采纳 | 环境一致、一键启动；邮件只进本地收件箱，可验证模板与附件且不污染真实邮箱 |

**ADR 维护规则**

- 新增或改变上述决策时，先在 ADR 中追加记录，再修改需求/设计正文。
- 状态取值：`提议` / `已采纳` / `已废弃` / `被替代`；被替代时保留原记录并链接新 ADR。
- 每条 ADR 至少包含：背景、备选方案、最终决策、影响（正面/负面）、生效版本。

---
