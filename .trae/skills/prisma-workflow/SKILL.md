---
name: prisma-workflow
description: 本项目的 Prisma 7 工作流：确保数据库、生成 Client、开发迁移、部署迁移、种子、Studio 与回滚；包含 relationMode="prisma" 与本地 Docker 数据库的注意事项。涉及数据库结构或数据初始化时使用。
---

# Prisma 工作流

## 环境

- PostgreSQL 16，本地由 `dev-containers/docker-compose.yml` 启动，映射 `127.0.0.1:5433`。
- `DATABASE_URL=postgresql://postgres:prisma@localhost:5433/supplier_microplatform`。
- Client 生成到 `src/generated/prisma`，不要手工修改生成文件。

## 常用命令

```bash
cd supplier-microplatform-nestjs

pnpm db:generate   # prisma generate
pnpm db:ensure     # 确保数据库存在（scripts/ensure-database.ts）
pnpm db:migrate    # 开发：创建并应用迁移（会先 ensure）
pnpm db:deploy     # 生产/CI：仅应用已有迁移
pnpm db:seed       # 初始化管理员与基础设置
pnpm db:studio     # 可视化查看
```

## 修改 Schema 的流程

1. 编辑 `prisma/schema.prisma`。
2. `pnpm db:migrate --name <变更说明>` 创建迁移并应用。
3. `pnpm db:generate` 重新生成 Client（`db:migrate` 通常会自动生成）。
4. 更新 `docs/data-model.md`。
5. 运行 `pnpm test && pnpm build`，提交迁移目录与 Schema。

## 生产/CI

```bash
pnpm install
pnpm db:deploy
pnpm db:seed     # 仅首次或需要修正管理员时
pnpm build
pnpm start:prod
```

- 不要在生产执行 `db:migrate`（会尝试创建迁移）。
- 迁移文件必须提交到仓库；无迁移文件的 Schema 变更不可部署。

## relationMode 注意

- `relationMode = "prisma"`，数据库层没有外键；级联删除与存在性由应用层负责。
- 关键唯一性依赖 `@@unique`/`@unique` 索引兜底（如 `order.inquiryId`、`quote(inquiryId,supplierId)`）。
- 若本地数据库与 Schema 漂移，先用 `prisma migrate diff` 查看差异，再决定迁移或修复；不要在未备份时执行 `docker compose -f dev-containers/docker-compose.yml down -v`。

## 种子

- `prisma/seed.ts` 使用 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`。
- 已存在管理员时更新角色与状态，不重复创建。
- 种子不写入业务测试数据，避免污染开发库。

## 回滚

- 开发环境优先通过新迁移修正，不手工改库。
- 需要重建本地库时（仓库根目录）：`docker compose -f dev-containers/docker-compose.yml down -v`，再 `docker compose -f dev-containers/docker-compose.yml up -d`，最后 `pnpm db:deploy && pnpm db:seed`（会清空数据，先确认）。
