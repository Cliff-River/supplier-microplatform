"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip, roleMeta } from "@/components/ui/status-chip";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";

interface MeResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  phone: string | null;
  mustChangePassword: boolean;
}

export default function AccountPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/me"),
  });

  useEffect(() => {
    if (!meQuery.data) return;
    // 以服务端数据回填表单初值。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: meQuery.data.name,
      phone: meQuery.data.phone ?? "",
    });
  }, [meQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<MeResponse>("/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
        }),
      }),
    onSuccess: () => {
      setSaveError(null);
      setNotice("个人资料已更新");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["internal-session"] });
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  if (meQuery.isLoading) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {meQuery.error ? errorMessage(meQuery.error) : "无法加载个人信息"}
      </p>
    );
  }

  const me = meQuery.data;
  const role = roleMeta[me.role];

  return (
    <div className="space-y-6">
      <PageHeader title="个人中心" description="维护个人资料与账号安全。" />

      {notice ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">基本资料</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="me-name">
                姓名
              </label>
              <input
                id="me-name"
                className={`${inputClass} mt-1`}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="me-phone">
                手机号
              </label>
              <input
                id="me-phone"
                className={`${inputClass} mt-1`}
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="me-username">
                用户名
              </label>
              <input
                id="me-username"
                className={`${inputClass} mt-1`}
                value={me.username}
                disabled
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="me-email">
                邮箱
              </label>
              <input
                id="me-email"
                className={`${inputClass} mt-1`}
                value={me.email}
                disabled
              />
            </div>
          </div>
          {saveError ? <p className={errorClass}>{saveError}</p> : null}
          <div className="flex justify-end">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "保存中…" : "保存资料"}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h3 className="text-sm font-semibold text-slate-900">账号信息</h3>
            <p className="text-slate-600">
              角色：<StatusChip tone={role.tone}>{role.label}</StatusChip>
            </p>
            <p className="text-xs text-slate-400">
              邮箱与用户名如需修改请联系管理员。
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h3 className="text-sm font-semibold text-slate-900">账号安全</h3>
            <p className="text-xs text-slate-500">
              建议定期修改密码，密码至少 8 位。
            </p>
            <Link href="/change-password" className={secondaryButtonClass}>
              修改密码
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
