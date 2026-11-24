"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  supplierStatusMeta,
  visibilityMeta,
} from "@/components/ui/status-chip";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string | null;
  status: "ACTIVE" | "DISABLED";
  visibilityScope: "ALL" | "SPECIFIED";
  ratingAvg: string | number;
  ratingCount: number;
  accountCount: number;
  openInquiryCount: number;
  orderCount: number;
}

const emptyFilters = {
  keyword: "",
  status: "",
  visibilityScope: "",
  ratingMin: "",
};

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ["suppliers", filters, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.status) params.set("status", filters.status);
      if (filters.visibilityScope) {
        params.set("visibilityScope", filters.visibilityScope);
      }
      if (filters.ratingMin) params.set("ratingMin", filters.ratingMin);
      return apiFetch<ListResult<SupplierRow>>(`/suppliers?${params}`);
    },
  });

  const rows = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta as
    | { page: number; pageSize: number; total: number }
    | undefined;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="供应商"
        description="维护供应商档案、账号、评级与可见范围。"
        actions={
          <Link href="/suppliers/new" className={primaryButtonClass}>
            新建供应商
          </Link>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={labelClass} htmlFor="supplier-keyword">
              关键词
            </label>
            <input
              id="supplier-keyword"
              className={`${inputClass} mt-1`}
              placeholder="名称 / 编码"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, keyword: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="supplier-status">
              状态
            </label>
            <select
              id="supplier-status"
              className={`${inputClass} mt-1`}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="ACTIVE">合作中</option>
              <option value="DISABLED">已停用</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="supplier-visibility">
              可见范围
            </label>
            <select
              id="supplier-visibility"
              className={`${inputClass} mt-1`}
              value={filters.visibilityScope}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  visibilityScope: event.target.value,
                }))
              }
            >
              <option value="">全部</option>
              <option value="ALL">全员可见</option>
              <option value="SPECIFIED">指定可见</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="supplier-rating">
              最低评级
            </label>
            <select
              id="supplier-rating"
              className={`${inputClass} mt-1`}
              value={filters.ratingMin}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, ratingMin: event.target.value }))
              }
            >
              <option value="">不限</option>
              <option value="4">≥ 4 分</option>
              <option value="3">≥ 3 分</option>
              <option value="2">≥ 2 分</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setPage(1);
                queryClient.invalidateQueries({ queryKey: ["suppliers"] });
              }}
            >
              筛选
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setFilters(emptyFilters);
                setPage(1);
              }}
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {listQuery.error ? (
          <p className="px-5 py-6 text-sm text-red-600">
            {errorMessage(listQuery.error)}
          </p>
        ) : listQuery.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">暂无供应商</p>
            <Link
              href="/suppliers/new"
              className={`${primaryButtonClass} mt-4`}
            >
              新建供应商
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">供应商</th>
                    <th className="px-4 py-3 font-medium">主营类别</th>
                    <th className="px-4 py-3 font-medium">综合评级</th>
                    <th className="px-4 py-3 font-medium">账号</th>
                    <th className="px-4 py-3 font-medium">合作中询价 / 订单</th>
                    <th className="px-4 py-3 font-medium">可见范围</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const status = supplierStatusMeta[row.status];
                    const visibility = visibilityMeta[row.visibilityScope];
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/suppliers/${row.id}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {row.name}
                          </Link>
                          <p className="text-xs text-slate-400">{row.code}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.category ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="tabular-nums">
                            {Number(row.ratingAvg).toFixed(1)}
                          </span>
                          <span className="ml-1 text-xs text-slate-400">
                            （{row.ratingCount}）
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {row.accountCount}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {row.openInquiryCount} / {row.orderCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={visibility.tone}>
                            {visibility.label}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={status.tone}>{status.label}</StatusChip>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/suppliers/${row.id}`}
                            className={smallButtonClass}
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => {
                const status = supplierStatusMeta[row.status];
                return (
                  <Link
                    key={row.id}
                    href={`/suppliers/${row.id}`}
                    className="block space-y-2 px-4 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">{row.name}</p>
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </div>
                    <p className="text-xs text-slate-500">
                      {row.code} · {row.category ?? "未分类"}
                    </p>
                    <p className="text-xs text-slate-500">
                      评级 {Number(row.ratingAvg).toFixed(1)} · 账号 {row.accountCount} ·
                      询价 {row.openInquiryCount} · 订单 {row.orderCount}
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {meta && meta.total > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              共 {meta.total} 家 · 第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={smallButtonClass}
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className={smallButtonClass}
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
