# API 说明

> 对应需求：[API 设计](../requirements.md#6-api-设计)。
> 基础路径：`/api`；开发环境前端通过 Next rewrite 同源代理到 `http://localhost:3100`。

## 1. 通用规范

| 项目 | 约定 |
| --- | --- |
| 认证 | HttpOnly Cookie 会话；内部与供应商接口使用不同守卫 |
| 数据格式 | JSON；上传为 `multipart/form-data` |
| 校验 | Zod Schema + `StandardSchemaValidationPipe`，错误信息中文 |
| 分页 | `page`（默认 1）、`pageSize`（默认 20，最大 100），响应 `meta` |
| 排序 | `sortBy`、`sortOrder=asc|desc`，仅白名单字段 |
| 时间 | ISO 8601；展示时区 `Asia/Shanghai` |
| 金额 | 字符串形式 Decimal |
| 幂等 | 发送、关闭、选标、完成等状态操作重复调用返回业务错误，不产生重复数据 |

### 成功响应

```json
{
  "success": true,
  "data": { "id": "clx...", "name": "示例项目" },
  "meta": { "page": 1, "pageSize": 20, "total": 42 }
}
```

### 失败响应

```json
{
  "success": false,
  "error": {
    "code": "INQUIRY_CLOSED",
    "message": "询价已关闭，无法提交报价",
    "details": null
  },
  "requestId": "req_01J..."
}
```

## 2. 认证接口（Better Auth 托管）

前缀：内部 `/api/auth/internal`，供应商 `/api/auth/supplier`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `…/sign-in/email` | 邮箱登录 |
| POST | `…/sign-in/username` | 用户名登录 |
| GET | `…/get-session` | 获取会话 |
| POST | `…/sign-out` | 退出 |
| POST | `…/request-password-reset` | 发送重置邮件 |
| POST | `…/reset-password` | 重置密码 |
| POST | `…/change-password` | 登录后改密（首次强制改密同用） |

安全限制：

- 公开注册已关闭：`…/sign-up*` 返回 404。
- 上述登录/找回/重置接口按 `IP + 路径` 限流：60 秒 10 次，超限 429 `TOO_MANY_REQUESTS`。
- 测试发信 `POST /api/admin/mail/test` 按 IP 限流：60 秒 5 次，超限 429。
- 停用账号无法建立新会话；已存在会话在业务请求时返回 403 `ACCOUNT_DISABLED`。
- `mustChangePassword=true` 时仅放行改密相关接口，其余返回 403 `PASSWORD_CHANGE_REQUIRED`。

## 3. 内部端接口

| 分组 | 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- | --- |
| 健康检查 | GET | `/api/health` | 公开 | 服务存活 |
| 当前用户 | GET | `/api/me` | 内部 | 会话用户 + 业务资料 |
| 当前用户 | PATCH | `/api/me` | 内部 | 修改姓名/手机 |
| 工作台 | GET | `/api/dashboard` | 内部 | 工作台数据（兼容入口） |
| 工作台 | GET | `/api/dashboard/overview` | 内部 | KPI、待办、最近项目、即将截止询价 |
| 用户管理 | GET | `/api/admin/users` | 管理员 | 分页、关键词、角色、状态筛选 |
| 用户管理 | POST | `/api/admin/users` | 管理员 | 创建内部用户并发送账号邮件 |
| 用户管理 | PATCH | `/api/admin/users/:id` | 管理员 | 修改姓名/角色/手机 |
| 用户管理 | POST | `/api/admin/users/:id/reset-password` | 管理员 | 触发重置密码邮件 |
| 用户管理 | POST | `/api/admin/users/:id/status` | 管理员 | 启用/停用（不可停用自己与最后一个管理员） |
| 内部通讯录 | GET | `/api/internal-users` | 内部 | 选择可见用户/联系人 |
| 审计 | GET | `/api/admin/audit-logs` | 管理员 | 关键操作日志 |
| 邮件 | GET | `/api/admin/mail-logs` | 管理员 | 邮件日志 |
| 邮件 | POST | `/api/admin/mail-logs/:id/retry` | 管理员 | 失败重发 |
| 邮件 | POST | `/api/admin/mail/test` | 管理员 | 测试发信 |
| 设置 | GET | `/api/admin/settings` | 管理员 | 平台信息、邮件状态 |
| 设置 | PUT | `/api/admin/settings` | 管理员 | 更新平台名称/地址/默认联系人 |
| 供应商 | GET | `/api/suppliers` | 内部 | 关键词、评级、可见范围、状态筛选 |
| 供应商 | POST | `/api/suppliers` | 内部 | 创建供应商，可同时创建首个账号 |
| 供应商 | GET | `/api/suppliers/:id` | 可见范围 | 详情 + 账号 + 评级 + 合作摘要 |
| 供应商 | PATCH | `/api/suppliers/:id` | 管理员/创建者 | 编辑资料 |
| 供应商 | PATCH | `/api/suppliers/:id/visibility` | 管理员/创建者 | 全员/指定用户 |
| 供应商账号 | POST | `/api/suppliers/:id/accounts` | 管理员/创建者 | 创建账号并发送邀请邮件 |
| 供应商账号 | PATCH | `/api/supplier-accounts/:id` | 管理员/创建者 | 修改姓名/手机/职位/状态 |
| 供应商账号 | POST | `/api/supplier-accounts/:id/reset-password` | 管理员/创建者 | 触发重置邮件 |
| 供应商账号 | DELETE | `/api/supplier-accounts/:id` | 管理员/创建者 | 停用并隐藏 |
| 评级 | GET | `/api/suppliers/:id/ratings` | 可见范围 | 评分历史与三维均分 |
| 评级 | POST | `/api/suppliers/:id/ratings` | 可见范围 | 新增/更新某询价的评分 |
| 项目 | GET | `/api/projects` | 内部 | 关键词、状态、负责人、时间筛选 |
| 项目 | POST | `/api/projects` | 内部 | 创建项目 + 默认询价项 |
| 项目 | GET | `/api/projects/:id` | 内部 | 详情 + 询价项 + 订单摘要 |
| 项目 | PATCH | `/api/projects/:id` | 管理员/创建者 | 编辑 |
| 项目 | POST | `/api/projects/:id/archive` | 管理员/创建者 | 归档 |
| 询价项 | GET | `/api/projects/:projectId/inquiries` | 内部 | 列表 |
| 询价项 | POST | `/api/projects/:projectId/inquiries` | 管理员/创建者 | 新增（DRAFT） |
| 询价项 | GET | `/api/inquiries/:id` | 内部 | 详情 + 受邀供应商 + 报价摘要 |
| 询价项 | PATCH | `/api/inquiries/:id` | 管理员/创建者 | 仅 DRAFT 可编辑 |
| 询价项 | DELETE | `/api/inquiries/:id` | 管理员/创建者 | 仅 DRAFT 可删除 |
| 询价项 | POST | `/api/inquiries/:id/send` | 管理员/创建者 | DRAFT → OPEN，发送询价邮件 |
| 询价项 | POST | `/api/inquiries/:id/close` | 管理员/创建者 | 手动关闭 |
| 询价项 | POST | `/api/inquiries/:id/reopen` | 管理员/创建者 | 设置新截止并重新开放 |
| 询价项 | POST | `/api/inquiries/:id/cancel` | 管理员/创建者 | 作废 |
| 询价项 | POST | `/api/inquiries/:id/resend` | 管理员/创建者 | 向指定供应商重发邮件 |
| 选标 | POST | `/api/inquiries/:id/award` | 管理员/创建者 | `supplierId`；同事务生成订单与合同 |
| 报价 | GET | `/api/inquiries/:id/quotes` | 内部 | 报价对比数据 |
| 报价 | GET | `/api/quotes/:id` | 内部 | 报价详情 + 附件 |
| 报价导出 | GET | `/api/inquiries/:id/quotes/export?format=xlsx` | 内部 | Excel 对比表 |
| 订单 | GET | `/api/orders` | 内部 | 列表 |
| 订单 | GET | `/api/orders/:id` | 内部 | 订单 + 合同 + 验收单 + 发票 |
| 订单 | POST | `/api/orders/:id/complete` | 项目创建者/管理员 | 标记完成 |
| 订单 | POST | `/api/orders/:id/cancel` | 项目创建者/管理员 | 取消 |
| 发票 | GET | `/api/orders/:id/invoices` | 内部 | 发票/请款记录（只读） |
| 合同 | POST | `/api/orders/:id/contract/return` | 项目创建者/管理员 | 上传修订版并回传 |
| 合同 | POST | `/api/orders/:id/contract/complete` | 项目创建者/管理员 | 标记线下签署完成 |
| 验收单 | POST | `/api/orders/:id/acceptance/sign` | 项目创建者/管理员 | 签署（需已有供应商上传） |

## 4. 供应商端接口

前缀 `/api/supplier`（认证接口除外）。

| 分组 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 当前账号 | GET | `/api/supplier/me` | 账号 + 所属供应商 |
| 当前账号 | PATCH | `/api/supplier/me` | 修改姓名/手机/职位 |
| 工作台 | GET | `/api/supplier/dashboard` | 待报价、待提交合同、进行中订单 |
| 工作台 | GET | `/api/supplier/dashboard/overview` | 工作台明细 |
| 询价 | GET | `/api/supplier/inquiries` | 仅被邀请且 `OPEN` |
| 询价 | GET | `/api/supplier/inquiries/:id` | 详情、附件、我的报价 |
| 报价 | PUT | `/api/supplier/inquiries/:id/quote` | 提交或修改报价（含附件 ID） |
| 报价历史 | GET | `/api/supplier/quote-history` | 自己提交过的报价（含已关闭/已选标），只读 |
| 订单 | GET | `/api/supplier/orders` | 自己的订单 |
| 订单 | GET | `/api/supplier/orders/:id` | 订单 + 合同 + 验收单 + 发票 |
| 合同 | POST | `/api/supplier/orders/:id/contract` | 上传合同与备注 |
| 验收单 | POST | `/api/supplier/orders/:id/acceptance` | 上传可选验收单（订单未完成） |
| 发票 | POST | `/api/supplier/orders/:id/invoices` | 提交发票与请款 |

## 5. 文件接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/files` | `multipart/form-data` 上传，返回 `{ id, fileName, size }`；初始为 TEMP |
| POST | `/api/files/:id/access-token` | 校验会话与数据权限，返回 5 分钟有效签名 URL |
| GET | `/api/files/:id/download?expires=…&signature=…` | 校验签名、会话与权限后流式下载 |
| DELETE | `/api/files/:id` | 仅未绑定业务的临时附件 |

## 6. 错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 参数校验失败 |
| 401 | `UNAUTHENTICATED` | 未登录或会话失效 |
| 403 | `FORBIDDEN` | 无权限 |
| 403 | `ACCOUNT_DISABLED` | 账号已停用 |
| 403 | `PASSWORD_CHANGE_REQUIRED` | 首次登录未改密 |
| 403 | `INVALID_FILE_SIGNATURE` | 文件签名无效或过期 |
| 404 | `NOT_FOUND` | 资源不存在或无权查看 |
| 409 | `INVALID_STATE` | 当前状态不允许该操作 |
| 409 | `ALREADY_AWARDED` | 询价项已选标 |
| 409 | `ORDER_COMPLETED` | 订单已完成，禁止提交 |
| 409 | `ACCEPTANCE_NOT_UPLOADED` | 验收单尚未上传 |
| 409 | `ACCEPTANCE_ALREADY_SIGNED` | 验收单已签署 |
| 409 | `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL` | 用户名/邮箱冲突 |
| 413 | `FILE_TOO_LARGE` | 超出上传大小 |
| 422 | `QUOTE_DEADLINE_PASSED` | 报价截止 |
| 429 | `TOO_MANY_REQUESTS` | 登录/找回密码/重置密码限流 |
| 500 | `INTERNAL_ERROR` | 未预期错误 |

## 7. 调试建议

```bash
# 健康检查
curl -i http://localhost:3100/api/health

# 通过前端代理访问
curl -i http://localhost:3000/api/health

# 登录后携带 Cookie 调用（示例）
curl -i -c /tmp/cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin12345"}' \
  http://localhost:3000/api/auth/internal/sign-in/username
```
