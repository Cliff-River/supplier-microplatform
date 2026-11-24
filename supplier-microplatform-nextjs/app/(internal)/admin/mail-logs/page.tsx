"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

interface MailLogRow {
  id: string;
  templateKey: string;
  toEmails: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

const statusMeta: Record<
  string,
  { label: string; tone: "green" | "red" | "amber" }
> = {
  SENT: { label: "已发送", tone: "green" },
  FAILED: { label: "失败", tone: "red" },
  PENDING: { label: "待发送", tone: "amber" },
};

export default function AdminMailLogsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["internal-session"],
    queryFn: () => getSession("internal"),
  });

  useEffect(() => {
    if (sessionQuery.data && sessionQuery.data.user.role !== "ADMIN") {
      router.replace("/forbidden");
    }
  }, [router, sessionQuery.data]);

  const logsQuery = useQuery({
    queryKey: ["mail-logs", status, keyword, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) params.set("status", status);
      if (keyword) params.set("keyword", keyword);
      return apiFetch<ListResult<MailLogRow>>(`/admin/mail-logs?${params}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/mail-logs/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      setNotice("已重新发送邮件");
      queryClient.invalidateQueries({ queryKey: ["mail-logs"] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const rows = logsQuery.data?.items ?? [];
  const meta = logsQuery.data?.meta as
    | { page: number; pageSize: number; total: number }
    | undefined;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="邮件日志"
        description="查看账号、询价、合同等通知邮件的发送状态，失败可重发。"
      />

      {notice ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {notice}
          <button
            type="button"
            className="ml-3 text-xs underline"
            onClick={() => setNotice(null)}
          >
            关闭
          </button>
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="mail-keyword">
              关键词
            </label>
            <input
              id="mail-keyword"
              className={`${inputClass} mt-1`}
              placeholder="收件人或主题"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="mail-status">
              状态
            </label>
            <select
              id="mail-status"
              className={`${inputClass} mt-1`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">全部</option>
              <option value="SENT">已发送</option>
              <option value="FAILED">失败</option>
              <option value="PENDING">待发送</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setPage(1);
                queryClient.invalidateQueries({ queryKey: ["mail-logs"] });
              }}
            >
              筛选
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setStatus("");
                setKeyword("");
                setPage(1);
              }}
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {logsQuery.error ? (
          <p className="px-5 py-6 text-sm text-red-600">
            {errorMessage(logsQuery.error)}
          </p>
        ) : logsQuery.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">暂无邮件日志</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">模板</th>
                  <th className="px-4 py-3 font-medium">收件人</th>
                  <th className="px-4 py-3 font-medium">主题</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">尝试</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const meta = statusMeta[row.status];
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {row.templateKey}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.toEmails}</td>
                      <td className="px-4 py-3 text-slate-700">{row.subject}</td>
                      <td className="px-4 py-3">
                        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                        {row.error ? (
                          <p className="mt-1 max-w-xs truncate text-[10px] text-red-500">
                            {row.error}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {row.attempts}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "FAILED" ? (
                          <button
                            type="button"
                            className={smallButtonClass}
                            disabled={retryMutation.isPending}
                            onClick={() => retryMutation.mutate(row.id)}
                          >
                            重发
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              共 {meta.total} 条 · 第 {page} / {totalPages} 页
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
