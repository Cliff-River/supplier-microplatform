# ADR-002 Prisma `relationMode = "prisma"`，不建数据库外键

- 状态：已采纳
- 生效版本：MVP v1.0
- 关联需求：1.5、5.1、5.5

## 背景

工程约定不在数据库层创建真实外键，以避免历史数据迁移、批量导入与后续分库时的约束阻塞。

## 备选方案

1. 使用数据库外键，依赖级联删除与约束检查。
2. Prisma `relationMode = "prisma"`，关系仅由应用层维护。

## 决策

采用方案 2。所有一致性（存在性、归属、重复）由 Service 层与 `prisma.$transaction` 保证，关键唯一性通过数据库唯一索引兜底（如 `order.inquiryId`、`quote(inquiryId,supplierId)`）。

## 影响

- 正面：迁移灵活；批量操作不受外键顺序限制。
- 负面：无法依赖数据库级联，删除必须显式处理；需要更严格的测试覆盖。
- 注意：实际部署环境若已存在外键，需要与 Schema 对齐；本仓库以迁移文件与 `prisma migrate deploy` 为准。
