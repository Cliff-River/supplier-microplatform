"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  UserFormModal,
  type UserFormValues,
} from "@/components/admin/user-form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip, roleMeta } from "@/components/ui/status-chip";
import { Modal } from "@/components/ui/modal";
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

interface InternalUserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface CreateResult {
  id: string;
  name: string;
  username: string;
  email: string;
  initialPassword: string;
  mailStatus: "SENT" | "FAILED" | "SKIPPED";
}

const emptyFilters = { keyword: "", role: "", status: "" };

export default function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<InternalUserRow | null>(null);
  const [created, setCreated] = useState<CreateResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
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

  const listQuery = useQuery({
    queryKey: ["admin-users", filters, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);
      return apiFetch<ListResult<InternalUserRow>>(`/admin/users?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      apiFetch<CreateResult>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          username: values.username,
          email: values.email,
          phone: values.phone ?? null,
          role: values.role,
        }),
      }),
    onSuccess: (result) => {
      setFormOpen(false);
      setCreated(result);
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setServerError(errorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) =>
      apiFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          phone: values.phone ?? null,
          role: values.role,
        }),
      }),
    onSuccess: () => {
      setFormOpen(false);
      setServerError(null);
      setNotice("用户信息已更新");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setServerError(errorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/users/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_data, variables) => {
      setNotice(variables.isActive ? "账号已启用" : "账号已停用");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/users/${id}/reset-password`, { method: "POST" }),
    onSuccess: () => setNotice("重置密码邮件已发送"),
    onError: (error) => setNotice(errorMessage(error)),
  });

  const rows = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta as
    | { page: number; pageSize: number; total: number }
    | undefined;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="内部用户"
        description="管理内部账号、角色与启用状态。"
        actions={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setFormMode("create");
              setEditing(null);
              setServerError(null);
              setFormOpen(true);
            }}
          >
            新建用户
          </button>
        }
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
          <div>
            <label className={labelClass} htmlFor="filter-keyword">
              关键词
            </label>
            <input
              id="filter-keyword"
              className={`${inputClass} mt-1`}
              placeholder="姓名 / 用户名 / 邮箱"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, keyword: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="filter-role">
              角色
            </label>
            <select
              id="filter-role"
              className={`${inputClass} mt-1`}
              value={filters.role}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, role: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="ADMIN">管理员</option>
              <option value="MEMBER">普通用户</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="filter-status">
              状态
            </label>
            <select
              id="filter-status"
              className={`${inputClass} mt-1`}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">全部</option>
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">已停用</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setPage(1);
                queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            暂无用户，点击「新建用户」开始。
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">姓名</th>
                    <th className="px-4 py-3 font-medium">用户名</th>
                    <th className="px-4 py-3 font-medium">邮箱</th>
                    <th className="px-4 py-3 font-medium">角色</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">最近登录</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const role = roleMeta[row.role];
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.name}
                          {row.mustChangePassword ? (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                              待改密
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.username}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3">
                          <StatusChip tone={role.tone}>{role.label}</StatusChip>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={row.isActive ? "green" : "neutral"}>
                            {row.isActive ? "启用" : "已停用"}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDateTime(row.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => {
                                setFormMode("edit");
                                setEditing(row);
                                setServerError(null);
                                setFormOpen(true);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `确认向 ${row.email} 发送重置密码邮件？`,
                                  )
                                ) {
                                  resetMutation.mutate(row.id);
                                }
                              }}
                            >
                              重置密码
                            </button>
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => {
                                const next = !row.isActive;
                                if (
                                  window.confirm(
                                    next
                                      ? `确认启用 ${row.name}？`
                                      : `确认停用 ${row.name}？停用后该用户将立即退出登录。`,
                                  )
                                ) {
                                  statusMutation.mutate({
                                    id: row.id,
                                    isActive: next,
                                  });
                                }
                              }}
                            >
                              {row.isActive ? "停用" : "启用"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{row.name}</p>
                    <StatusChip tone={row.isActive ? "green" : "neutral"}>
                      {row.isActive ? "启用" : "已停用"}
                    </StatusChip>
                  </div>
                  <p className="text-xs text-slate-500">
                    {row.username} · {row.email}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={smallButtonClass}
                      onClick={() => {
                        setFormMode("edit");
                        setEditing(row);
                        setServerError(null);
                        setFormOpen(true);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={smallButtonClass}
                      onClick={() => resetMutation.mutate(row.id)}
                    >
                      重置密码
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
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

      <UserFormModal
        open={formOpen}
        mode={formMode}
        initial={
          editing
            ? {
                name: editing.name,
                username: editing.username,
                email: editing.email,
                phone: editing.phone ?? "",
                role: editing.role,
              }
            : undefined
        }
        submitting={createMutation.isPending || updateMutation.isPending}
        serverError={serverError}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (formMode === "create") {
            await createMutation.mutateAsync(values);
          } else if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, values });
          }
        }}
      />

      <Modal
        open={Boolean(created)}
        title="账号已创建"
        description="请将以下初始密码通过安全方式告知用户，首次登录后必须修改密码。"
        onClose={() => setCreated(null)}
        footer={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setCreated(null)}
          >
            知道了
          </button>
        }
      >
        {created ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              姓名：<span className="font-medium">{created.name}</span>
            </p>
            <p>
              用户名：<span className="font-mono">{created.username}</span>
            </p>
            <p>
              邮箱：<span className="font-mono">{created.email}</span>
            </p>
            <p>
              初始密码：
              <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono">
                {created.initialPassword}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              初始密码邮件发送状态：
              {created.mailStatus === "SENT"
                ? "已发送"
                : created.mailStatus === "FAILED"
                  ? "发送失败，请人工告知"
                  : "未发送"}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
