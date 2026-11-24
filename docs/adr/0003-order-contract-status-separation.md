# ADR-003 订单状态与合同状态分离

- 状态：已采纳
- 生效版本：MVP v1.0
- 关联需求：4.3、5.2

## 背景

合同存在多轮往来（供应商提交、内部回传修订、线下签署完成），若与订单履约状态合并在一个字段，会互相污染：合同反复修订不应回退订单进度，订单完成也不应强制合同必须签署。

## 备选方案

1. 单一 `order.status` 同时表达履约与合同。
2. `order.status` 与 `contract.status` 两条状态机并行。

## 决策

采用方案 2：
- 订单：`PENDING_CONTRACT` → `IN_PROGRESS` → `COMPLETED`，可 `CANCELLED`。
- 合同：`PENDING_SUBMISSION` → `SUBMITTED` → `RETURNED` → `COMPLETED`。

## 影响

- 正面：合同多轮往来不影响履约状态；页面可按两个维度独立展示。
- 负面：需要明确两者联动规则，例如供应商首次提交合同后订单进入 `IN_PROGRESS`。
- 约束：订单完成前不要求合同必须 `COMPLETED`。
