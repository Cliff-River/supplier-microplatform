# ADR-009 附件短期签名 URL + 会话与权限校验

- 状态：已采纳
- 生效版本：MVP v1.0
- 关联需求：6.5、9.1、12.7

## 背景

附件直接以自增或可枚举 ID 暴露下载地址时，存在盗链与越权枚举风险。合同、报价、发票等文件包含商业敏感信息。

## 备选方案

1. 登录后直接 `GET /api/files/:id` 返回文件。
2. 生成短期签名 URL，下载时校验签名、有效期、会话与数据权限。

## 决策

采用方案 2：
- `POST /api/files/:id/access-token` 先校验会话与数据权限，返回 5 分钟有效的 `expires + signature`。
- `GET /api/files/:id/download` 再次校验签名、过期时间、会话与权限，任一失败返回 403 `INVALID_FILE_SIGNATURE` / `FORBIDDEN`。

## 影响

- 正面：降低 ID 枚举与盗链风险；URL 可安全用于前端下载。
- 负面：下载需两次请求；签名密钥 `FILE_SIGNING_SECRET` 需妥善管理，轮换后旧链接立即失效。
