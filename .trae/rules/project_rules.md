# Monorepo 规则

适用于 `supplier-microplatform` 根目录及两个子项目。

## 包管理

- 统一使用 `pnpm`，禁止 `npm` / `yarn`；每个子项目维护自己的 `pnpm-lock.yaml`。
- 新增依赖前先评估现有依赖或成熟库能否满足；不要为一次性需求引入新包。
- 依赖版本策略：Prisma `>=7.10 <8.0`、Better Auth `>=1.7 <1.8` 固定区间；其余取与 NestJS 12 / Next.js 16 / React 19 / HeroUI v3 / Tailwind 4 兼容的最新稳定版。
- 升级依赖后必须跑通前后端的 `lint`、`test`、`build`。

## 目录边界

- `supplier-microplatform-nestjs/`：只放后端代码、Prisma Schema/迁移、后端配置；不写前端组件。
- `supplier-microplatform-nextjs/`：只放前端页面、组件、样式与客户端工具；不直接访问数据库。
- `docs/`：工程文档与 ADR；`requirements.md` 为需求与验收的单一事实来源。
- 根目录只放跨项目文件（README、requirements、docs、.trae）与本地容器编排目录 `dev-containers/`。

## 提交前检查

```bash
cd supplier-microplatform-nestjs && pnpm lint && pnpm test && pnpm build
cd supplier-microplatform-nextjs && pnpm lint && pnpm exec vitest run && pnpm build
```

- 不自动执行 `git commit`、`git push` 或破坏性 Git 操作，除非用户明确要求。
- 不提交 `.env`、`storage/uploads`、`node_modules`、`.next`、`dist`。
- 涉及数据库结构变更时，同时提交迁移文件并说明本地应用方式。

## 文档维护

- 修改接口、表结构、页面路由时，同步更新 `docs/api.md`、`docs/data-model.md`、`docs/pages.md`。
- 新增或改变关键架构决策时，先新增 `docs/adr/NNNN-*.md`，再改实现与文档。
- 文档中的命令以仓库根目录为基准；子项目命令需先 `cd`。
- 不创建与任务无关的临时 Markdown 文件；草稿、调试输出放在仓库外或 `/tmp`。
