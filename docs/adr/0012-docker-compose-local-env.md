# ADR-012 本地开发使用 Docker Compose（PostgreSQL + Mailpit）

- 状态：已采纳
- 生效版本：MVP v1.0
- 关联需求：2.6、7.1

## 背景

团队本地环境差异会导致数据库版本、字符集、时区不一致；邮件通知又需要可验证 HTML 与附件，而不能污染真实邮箱。

## 备选方案

1. 各自安装 PostgreSQL 与真实 SMTP。
2. 使用 `docker-compose` 提供 PostgreSQL 16 与 Mailpit，邮件只进本地收件箱。

## 决策

采用方案 2。根目录 `docker-compose.yml` 启动：
- `postgres:16-alpine`，映射 `127.0.0.1:5433:5432`，数据持久化到 `pgdata` 卷；
- `axllent/mailpit`，SMTP `1025`，Web UI `8025`。

## 影响

- 正面：一键启动、环境一致；可查看邮件正文、附件与原始 MIME。
- 负面：需本地安装 Docker；端口冲突时需调整映射并同步 `DATABASE_URL`。
- 说明：该文件只服务本地与 CI，不参与生产部署；生产通过环境变量切换真实 SMTP。
