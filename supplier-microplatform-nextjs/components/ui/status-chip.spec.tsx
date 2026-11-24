import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  StatusChip,
  orderStatusMeta,
  contractStatusMeta,
  acceptanceStatusMeta,
} from "./status-chip";

afterEach(cleanup);

describe("StatusChip", () => {
  it("渲染状态文本", () => {
    render(<StatusChip tone="green">已完成</StatusChip>);
    expect(screen.getByText("已完成")).toBeDefined();
  });
});

describe("状态映射", () => {
  it("订单、合同、验收单状态均有中文标签", () => {
    expect(orderStatusMeta.IN_PROGRESS.label).toBeTruthy();
    expect(orderStatusMeta.COMPLETED.label).toBeTruthy();
    expect(contractStatusMeta.SUBMITTED.label).toBeTruthy();
    expect(acceptanceStatusMeta.SIGNED.label).toBeTruthy();
  });

  it("未知状态不会崩溃", () => {
    expect(orderStatusMeta.UNKNOWN).toBeUndefined();
  });
});
