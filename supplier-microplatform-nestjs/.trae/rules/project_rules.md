# 后端规则（NestJS 12 / ESM / Prisma 7）

## 框架与语言

- NestJS 12 为 ESM：相对导入必须带 `.js`；使用 `import.meta.dirname`，不要用 `__dirname`。
- TypeScript 严格模式；避免 `any`；共享类型在项目内定义。
- 参数校验使用 Zod + `StandardSchemaValidationPipe`（`@Body({ schema })`、`@Param('id', { schema })`），不要新增 class-validator 装饰器。
- 测试使用 Vitest：mock 用 `vi.fn()`，不要用 `jest.fn()`。

## 模块边界

- Controller 只做参数解析与权限编排；业务规则与跨表写操作放 Service。
- 跨表写入必须使用 `prisma.$transaction`，尤其是选标（询价 + 订单 + 合同）、账号创建、评级聚合。
- 数据库访问集中在 Service / PrismaService，不把 Prisma 客户端泄漏到 Controller。
- 模块按业务域放在 `src/modules/<domain>/`，公共能力放 `src/common/`。

## 认证与权限

- 内部接口使用 `InternalAuthGuard`，供应商接口使用 `SupplierAuthGuard`；管理员接口叠加 `@Roles('ADMIN')` 或显式校验。
- 写操作必须校验资源归属：项目创建者/管理员，或供应商只能操作自己企业的数据。
- 停用账号、`mustChangePassword`、归档项目只读等规则在服务端强制执行，不能只靠前端隐藏。

## 错误与响应

- 使用 `AppException` + `ErrorCode`，禁止把数据库错误直接暴露给前端。
- 成功响应由拦截器包装 `{ success, data, meta? }`；失败由全局过滤器包装 `{ success:false, error, requestId }`。
- 状态操作需幂等：重复调用返回明确业务错误，不产生重复数据。

## Prisma

- `relationMode = "prisma"`，不建数据库外键；关键唯一性用 `@@unique` 兜底。
- 修改 Schema 后执行 `pnpm db:generate`；迁移使用 `pnpm db:migrate`，部署使用 `pnpm db:deploy`。
- 金额使用 `Decimal`，接口以字符串返回；时间统一 ISO 8601。
- 种子脚本使用 `SEED_ADMIN_*`，不要硬编码生产密码。

## 邮件与存储

- 邮件模板集中在 `src/mail/`，禁止在业务代码拼接大段 HTML；发信失败不阻塞业务，但必须写 `mail_log`。
- 附件通过 `StorageService` 访问，不直接写文件系统；下载必须走签名 URL 与权限校验。

## 提交前

```bash
pnpm lint && pnpm test && pnpm build
```
