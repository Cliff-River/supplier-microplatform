"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip, projectStatusMeta } from "@/components/ui/status-chip";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  customerName: string | null;
  status: "ACTIVE" | "ARCHIVED";
  inquiryCount: number;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const emptyFilters = { keyword: "", status: "", ownerId: "" };

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const usersQuery = useQuery({
    queryKey: ["internal-users"],
    queryFn: () => apiFetch<DirectoryUser[]>("/internal-users"),
  });

  const listQuery = useQuery({
    queryKey: ["projects", filters, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.status) params.set("status", filters.status);
      if (filters.ownerId) params.set("ownerId", filters.ownerId);
      return apiFetch<ListResult<ProjectRow>>(`/projects?${params}`);
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
        title="项目"
        description="管理采购项目与询价项，跟踪订单与发票。"
        actions={
          <Link href="/projects/new" className={primaryButtonClass}>
            新建项目
          </Link>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor="project-keyword">
              关键词
            </label>
            <input
              id="project-keyword"
              className={`${inputClass} mt-1`}
              placeholder="项目名称 / 编号 / 客户"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, keyword: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="project-status">
              状态
            </label>
            <select
              id="project-status"
              className={`${inputClass} mt-1`}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="ACTIVE">进行中</option>
              <option value="ARCHIVED">已归档</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="project-owner">
              负责人
            </label>
            <select
              id="project-owner"
              className={`${inputClass} mt-1`}
              value={filters.ownerId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, ownerId: event.target.value }))
              }
            >
              <option value="">全部</option>
              {(usersQuery.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setPage(1);
                queryClient.invalidateQueries({ queryKey: ["projects"] });
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
            <p className="text-sm text-slate-500">暂无项目</p>
            <Link href="/projects/new" className={`${primaryButtonClass} mt-4`}>
              新建项目
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">项目</th>
                    <th className="px-4 py-3 font-medium">客户</th>
                    <th className="px-4 py-3 font-medium">询价项</th>
                    <th className="px-4 py-3 font-medium">负责人</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">最近更新</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const status = projectStatusMeta[row.status];
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${row.id}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {row.name}
                          </Link>
                          <p className="text-xs text-slate-400">{row.code}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.customerName ?? "-"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {row.inquiryCount}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.ownerName ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={status.tone}>{status.label}</StatusChip>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDateTime(row.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${row.id}`}
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
                const status = projectStatusMeta[row.status];
                return (
                  <Link
                    key={row.id}
                    href={`/projects/${row.id}`}
                    className="block space-y-2 px-4 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">{row.name}</p>
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </div>
                    <p className="text-xs text-slate-500">
                      {row.code} · {row.customerName ?? "未填写客户"}
                    </p>
                    <p className="text-xs text-slate-500">
                      询价项 {row.inquiryCount} · 负责人 {row.ownerName ?? "-"} ·
                      更新 {formatDateTime(row.updatedAt)}
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
              共 {meta.total} 个项目 · 第 {page} / {totalPages} 页
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
