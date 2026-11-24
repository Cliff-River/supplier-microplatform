# 前端规则（Next.js 16 App Router / HeroUI v3 / Tailwind 4）

## 路由与渲染

- 使用 App Router；动态路由保持「Server Page + `<Suspense>` + `{params.then(...)}`」，不要在 Client Component 中直接使用 `useParams()` 而缺少 Suspense。
- 内部端与供应商端 portal layout 必须保留 `export const instant = false;`（依赖登录态与当前路径）。
- 登录态数据使用 Client Component + TanStack Query；布局与静态壳使用 Server Component。
- 不在页面中硬编码后端地址；统一通过 `/api` 同源代理访问。

## 目录边界

- `app/(auth)/`：登录、找回、重置、改密。
- `app/(internal)/`：内部端页面，使用 `InternalShell`。
- `app/supplier/`：供应商端页面，`(portal)` 下使用 `SupplierShell`。
- `components/`：可复用组件；`lib/`：请求、认证、格式化、下载等纯工具。
- 页面超过约 300 行时拆分 client 组件或子组件，避免单文件膨胀。

## UI 与样式

- 优先 HeroUI v3 复合组件（如 `Card.Header`）与 Tailwind 工具类；避免内联样式与新增全局 CSS。
- 页面背景 `zinc-50`，卡片白底 `rounded-2xl` 细边框；金额与数量使用 `tabular-nums`。
- 日期统一经 `lib/format.ts` 格式化，时区 `Asia/Shanghai`。
- 图标保持同一套线性风格，不混用多套图标库。

## 认证与跳转

- 未登录跳转对应登录页；`mustChangePassword=true` 强制进入改密页。
- 内部会话访问 `/supplier/*`、供应商会话访问内部页面、非管理员访问 `/admin/*` 均跳 `/forbidden`。
- 登录成功后回跳 `redirect` 参数，缺省进入对应工作台。

## 交互与状态

- 加载、空、错误、无权限四种状态都要有明确展示。
- 表单使用 `react-hook-form` + `zod`；提交按钮防重；危险操作二次确认。
- 附件上传先调 `POST /api/files`，下载先取签名 URL。
- 已归档项目只读：隐藏写操作入口，并依赖服务端拒绝兜底。

## 提交前

```bash
pnpm lint && pnpm exec vitest run && pnpm build
```
