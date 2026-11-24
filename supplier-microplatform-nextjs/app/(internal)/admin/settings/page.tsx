"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

interface SettingsResponse {
  platform: {
    name: string;
    url: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    from: string;
    hasAuth: boolean;
  };
}

interface MailLogRow {
  id: string;
  templateKey: string;
  toEmails: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  error: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface AuditLogRow {
  id: string;
  action: string;
  actorType: string;
  actorName: string | null;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

const mailStatusMeta: Record<
  string,
  { label: string; tone: "green" | "red" | "amber" }
> = {
  SENT: { label: "已发送", tone: "green" },
  FAILED: { label: "失败", tone: "red" },
  PENDING: { label: "待发送", tone: "amber" },
};

type TabKey = "platform" | "mail" | "audit";

export default function AdminSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("platform");
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    platformName: "",
    platformUrl: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [testTo, setTestTo] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [mailPage, setMailPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const sessionQuery = useQuery({
    queryKey: ["internal-session"],
    queryFn: () => getSession("internal"),
  });

  useEffect(() => {
    if (sessionQuery.data && sessionQuery.data.user.role !== "ADMIN") {
      router.replace("/forbidden");
    }
  }, [router, sessionQuery.data]);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<SettingsResponse>("/admin/settings"),
  });

  useEffect(() => {
    const platform = settingsQuery.data?.platform;
    if (!platform) return;
    // 以服务端设置回填表单初值。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      platformName: platform.name,
      platformUrl: platform.url,
      contactName: platform.contactName,
      contactPhone: platform.contactPhone,
      contactEmail: platform.contactEmail,
    });
    setTestTo((prev) => prev || platform.contactEmail);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<SettingsResponse>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          platformName: form.platformName,
          platformUrl: form.platformUrl,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
        }),
      }),
    onSuccess: () => {
      setSaveError(null);
      setNotice("系统设置已保存，邮件模板将立即使用新的平台信息。");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ status: string }>("/admin/mail/test", {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      }),
    onSuccess: (result) => {
      setTestError(null);
      setNotice(
        result.status === "SENT"
          ? "测试邮件已发送，请到收件箱（本地为 Mailpit）查看。"
          : "测试邮件发送失败，请检查服务器邮件配置。",
      );
      queryClient.invalidateQueries({ queryKey: ["mail-logs"] });
    },
    onError: (error) => setTestError(errorMessage(error)),
  });

  const mailLogsQuery = useQuery({
    queryKey: ["mail-logs", mailPage],
    queryFn: () =>
      apiFetch<ListResult<MailLogRow>>(
        `/admin/mail-logs?page=${mailPage}&pageSize=20`,
      ),
    enabled: tab === "mail",
  });

  const auditLogsQuery = useQuery({
    queryKey: ["audit-logs", auditPage],
    queryFn: () =>
      apiFetch<ListResult<AuditLogRow>>(
        `/admin/audit-logs?page=${auditPage}&pageSize=20`,
      ),
    enabled: tab === "audit",
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

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "platform", label: "平台设置" },
    { key: "mail", label: "邮件日志" },
    { key: "audit", label: "审计日志" },
  ];

  function pagination(
    meta: { page: number; pageSize: number; total: number } | undefined,
    page: number,
    setPage: (value: number) => void,
  ) {
    if (!meta || meta.total === 0) return null;
    const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    return (
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>
          共 {meta.total} 条 · 第 {page} / {totalPages} 页
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={smallButtonClass}
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            上一页
          </button>
          <button
            type="button"
            className={smallButtonClass}
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="维护平台信息、邮件配置与查看系统日志。"
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

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 pt-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-t-lg px-4 py-2 text-sm transition ${
              tab === item.key
                ? "border-b-2 border-blue-600 font-medium text-blue-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "platform" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">平台信息</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="platform-name">
                  平台名称
                </label>
                <input
                  id="platform-name"
                  className={`${inputClass} mt-1`}
                  value={form.platformName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      platformName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="platform-url">
                  平台访问地址
                </label>
                <input
                  id="platform-url"
                  className={`${inputClass} mt-1`}
                  placeholder="https://supplier.example.com"
                  value={form.platformUrl}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      platformUrl: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="contact-name">
                  联系人
                </label>
                <input
                  id="contact-name"
                  className={`${inputClass} mt-1`}
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contactName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="contact-phone">
                  联系电话
                </label>
                <input
                  id="contact-phone"
                  className={`${inputClass} mt-1`}
                  value={form.contactPhone}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contactPhone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="contact-email">
                  联系邮箱
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className={`${inputClass} mt-1`}
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contactEmail: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {saveError ? <p className={errorClass}>{saveError}</p> : null}
            <div className="flex justify-end">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "保存中…" : "保存设置"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
              <h3 className="text-sm font-semibold text-slate-900">邮件配置</h3>
              {settingsQuery.data ? (
                <dl className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">SMTP 主机</dt>
                    <dd className="font-mono">{settingsQuery.data.mail.host}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">端口</dt>
                    <dd className="font-mono">{settingsQuery.data.mail.port}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">加密</dt>
                    <dd>{settingsQuery.data.mail.secure ? "TLS" : "STARTTLS/无"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">发件人</dt>
                    <dd className="font-mono">{settingsQuery.data.mail.from}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">认证</dt>
                    <dd>{settingsQuery.data.mail.hasAuth ? "已配置" : "未配置"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-slate-400">加载中…</p>
              )}
              <p className="text-xs text-slate-400">
                邮件服务配置来自服务端环境变量，修改后需重启服务。
              </p>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
              <h3 className="text-sm font-semibold text-slate-900">发送测试邮件</h3>
              <input
                className={inputClass}
                placeholder="收件人邮箱"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
              />
              {testError ? <p className={errorClass}>{testError}</p> : null}
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={testMutation.isPending || !testTo}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? "发送中…" : "发送测试邮件"}
              </button>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "mail" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {mailLogsQuery.error ? (
            <p className="px-5 py-6 text-sm text-red-600">
              {errorMessage(mailLogsQuery.error)}
            </p>
          ) : mailLogsQuery.isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
          ) : (mailLogsQuery.data?.items ?? []).length === 0 ? (
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
                    <th className="px-4 py-3 font-medium">时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(mailLogsQuery.data?.items ?? []).map((row) => {
                    const status = mailStatusMeta[row.status];
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {row.templateKey}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.toEmails}</td>
                        <td className="px-4 py-3 text-slate-700">{row.subject}</td>
                        <td className="px-4 py-3">
                          <StatusChip tone={status.tone}>{status.label}</StatusChip>
                          {row.error ? (
                            <p className="mt-1 max-w-xs truncate text-[10px] text-red-500">
                              {row.error}
                            </p>
                          ) : null}
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
          {pagination(
            mailLogsQuery.data?.meta as
              | { page: number; pageSize: number; total: number }
              | undefined,
            mailPage,
            setMailPage,
          )}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {auditLogsQuery.error ? (
            <p className="px-5 py-6 text-sm text-red-600">
              {errorMessage(auditLogsQuery.error)}
            </p>
          ) : auditLogsQuery.isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
          ) : (auditLogsQuery.data?.items ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">暂无审计日志</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                    <th className="px-4 py-3 font-medium">操作人</th>
                    <th className="px-4 py-3 font-medium">摘要</th>
                    <th className="px-4 py-3 font-medium">对象</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(auditLogsQuery.data?.items ?? []).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {row.action}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.actorName ?? row.actorType}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.summary}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {row.targetType}
                        <span className="ml-1 font-mono">{row.targetId.slice(0, 8)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagination(
            auditLogsQuery.data?.meta as
              | { page: number; pageSize: number; total: number }
              | undefined,
            auditPage,
            setAuditPage,
          )}
        </section>
      ) : null}
    </div>
  );
}
