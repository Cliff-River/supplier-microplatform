import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  toDateInputValue,
  toDateTimeInputValue,
} from "./format";

describe("formatMoney", () => {
  it("格式化人民币金额并保留两位小数", () => {
    expect(formatMoney("58000", "CNY")).toContain("58,000.00");
    expect(formatMoney(1234.5)).toContain("1,234.50");
  });

  it("空值返回占位符", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(undefined)).toBe("-");
    expect(formatMoney("")).toBe("-");
    expect(formatMoney("abc")).toBe("-");
  });
});

describe("formatNumber", () => {
  it("最多保留三位小数", () => {
    expect(formatNumber("10")).toBe("10");
    expect(formatNumber(10.5)).toBe("10.5");
    expect(formatNumber("1.23456")).toBe("1.235");
  });
});

describe("formatDateTime / formatDate", () => {
  it("按上海时区展示", () => {
    expect(formatDateTime("2026-11-24T13:05:00.000Z")).toContain("21:05");
    expect(formatDate("2026-11-24T13:05:00.000Z")).toContain("2026");
  });

  it("非法输入返回占位符", () => {
    expect(formatDateTime("not-a-date")).toBe("-");
    expect(formatDate(null)).toBe("-");
  });
});

describe("toDateInputValue / toDateTimeInputValue", () => {
  it("转换为上海时区的输入框值", () => {
    expect(toDateInputValue("2026-11-24T16:30:00.000Z")).toBe("2026-11-25");
    expect(toDateTimeInputValue("2026-11-24T13:05:00.000Z")).toBe(
      "2026-11-24T21:05",
    );
  });

  it("空值返回空字符串", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateTimeInputValue(undefined)).toBe("");
    expect(toDateInputValue("bad-date")).toBe("");
  });
});
