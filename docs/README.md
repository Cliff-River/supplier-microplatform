# 文档索引

本目录是 MVP 开发完成后从 `requirements.md` 拆分出的工程文档。需求与验收口径仍以根目录 [requirements.md](../requirements.md) 为单一事实来源，本目录负责实现层面的说明与索引。

| 文档 | 内容 |
| --- | --- |
| [architecture.md](./architecture.md) | 总体架构、请求链路、模块边界、认证与权限、存储与邮件、状态机概览 |
| [data-model.md](./data-model.md) | 数据表、枚举、关系与一致性规则、迁移与种子 |
| [api.md](./api.md) | 接口清单、通用规范、响应包络、错误码、文件访问 |
| [pages.md](./pages.md) | 前端信息架构、页面清单、路由守卫与跳转规则 |
| [adr/](./adr/) | 架构决策记录，每条决策独立成文件（ADR-001 ~ ADR-013） |

## 阅读顺序

1. 新成员：根 [README.md](../README.md) → 本文 → [architecture.md](./architecture.md)
2. 后端开发：[architecture.md](./architecture.md) → [data-model.md](./data-model.md) → [api.md](./api.md)
3. 前端开发：[pages.md](./pages.md) → [architecture.md](./architecture.md) 的权限与状态机部分
4. 需要理解「为什么这样设计」：查看 [adr/](./adr/)

## 维护约定

- 修改接口、表结构或页面路由时，同步更新对应文档，保持与代码一致。
- 新增或变更关键架构决策时，先新增 ADR，再修改实现与文档。
- 文档中的命令均以仓库根目录为基准；子项目命令需先 `cd` 到对应目录。
