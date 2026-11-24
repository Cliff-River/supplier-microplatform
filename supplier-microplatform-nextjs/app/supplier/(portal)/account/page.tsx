"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip, supplierStatusMeta } from "@/components/ui/status-chip";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";

interface SupplierMeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    phone: string | null;
    title: string | null;
    isPrimary: boolean;
  };
  supplier: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    status: "ACTIVE" | "DISABLED";
  };
}

export default function SupplierAccountPage() {
  const meQuery = useQuery({
    queryKey: ["supplier-me"],
    queryFn: () => apiFetch<SupplierMeResponse>("/supplier/me"),
  });

  if (meQuery.isLoading) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {meQuery.error ? errorMessage(meQuery.error) : "无法加载账号信息"}
      </p>
    );
  }

  return <AccountView data={meQuery.data} />;
}

function AccountView({ data }: { data: SupplierMeResponse }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: data.user.name,
    phone: data.user.phone ?? "",
    title: data.user.title ?? "",
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<SupplierMeResponse["user"]>("/supplier/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          title: form.title || null,
        }),
      }),
    onSuccess: () => {
      setSaveError(null);
      setNotice("个人资料已更新");
      queryClient.invalidateQueries({ queryKey: ["supplier-me"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-session"] });
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  const { user, supplier } = data;
  const statusMeta = supplierStatusMeta[supplier.status];

  return (
    <div className="space-y-6">
      <PageHeader title="账号" description="维护个人资料并查看所属企业信息。" />

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
              <label className={labelClass} htmlFor="supplier-account-name">
                姓名
              </label>
              <input
                id="supplier-account-name"
                className={`${inputClass} mt-1`}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-account-phone">
                手机号
              </label>
              <input
                id="supplier-account-phone"
                className={`${inputClass} mt-1`}
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-account-title">
                职位
              </label>
              <input
                id="supplier-account-title"
                className={`${inputClass} mt-1`}
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-account-username">
                用户名
              </label>
              <input
                id="supplier-account-username"
                className={`${inputClass} mt-1`}
                value={user.username}
                disabled
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="supplier-account-email">
                邮箱
              </label>
              <input
                id="supplier-account-email"
                className={`${inputClass} mt-1`}
                value={user.email}
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
            <h3 className="text-sm font-semibold text-slate-900">所属企业</h3>
            <p className="text-slate-700">{supplier.name}</p>
            <p className="text-xs text-slate-400">{supplier.code}</p>
            {statusMeta ? (
              <StatusChip tone={statusMeta.tone}>{statusMeta.label}</StatusChip>
            ) : null}
            <p className="text-xs text-slate-400">
              邮箱与用户名如需修改请联系采购方管理员。
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h3 className="text-sm font-semibold text-slate-900">账号安全</h3>
            <p className="text-xs text-slate-500">
              建议定期修改密码，密码至少 8 位。
            </p>
            <Link
              href="/supplier/change-password"
              className={secondaryButtonClass}
            >
              修改密码
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
