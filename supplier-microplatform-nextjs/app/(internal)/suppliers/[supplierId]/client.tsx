"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  supplierStatusMeta,
  visibilityMeta,
} from "@/components/ui/status-chip";
import {
  dangerButtonClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";

interface Account {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Rating {
  id: string;
  inquiryId: string;
  quoteQuality: number;
  responseSpeed: number;
  serviceAttitude: number;
  score: string | number;
  comment: string | null;
  ratedByName: string | null;
  updatedAt: string;
}

interface CooperationQuote {
  id: string;
  totalPrice: string | number;
  currency: string;
  version: number;
  submittedAt: string;
  inquiry: {
    id: string;
    code: string;
    title: string;
    status: string;
    project: { id: string; name: string };
    order: { id: string; orderNo: string } | null;
  };
}

interface CooperationOrder {
  id: string;
  orderNo: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string;
  project: { id: string; name: string };
}

interface SupplierDetail {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
  remark: string | null;
  status: "ACTIVE" | "DISABLED";
  visibilityScope: "ALL" | "SPECIFIED";
  ratingAvg: string | number;
  ratingCount: number;
  createdAt: string;
  canManage: boolean;
  accounts: Account[];
  visibilityUsers: Array<{ id: string; name: string | null; email: string | null }>;
  ratings: Rating[];
  cooperation: { quotes: CooperationQuote[]; orders: CooperationOrder[] };
}

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

type TabKey = "accounts" | "ratings" | "cooperation" | "visibility";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "accounts", label: "账号" },
  { key: "ratings", label: "评级" },
  { key: "cooperation", label: "合作记录" },
  { key: "visibility", label: "可见范围" },
];

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("accounts");
  const [notice, setNotice] = useState<string | null>(null);

  const [accountModal, setAccountModal] = useState<{
    mode: "create" | "edit";
    account?: Account;
  } | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    title: "",
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    inquiryId: "",
    quoteQuality: 5,
    responseSpeed: 5,
    serviceAttitude: 5,
    comment: "",
  });
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityForm, setVisibilityForm] = useState<{
    scope: "ALL" | "SPECIFIED";
    userIds: string[];
  }>({ scope: "ALL", userIds: [] });
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => apiFetch<SupplierDetail>(`/suppliers/${supplierId}`),
  });

  const directoryQuery = useQuery({
    queryKey: ["internal-directory"],
    queryFn: () => apiFetch<DirectoryUser[]>("/internal-users"),
    enabled: visibilityOpen,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "DISABLED") =>
      apiFetch(`/suppliers/${supplierId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      setNotice("供应商状态已更新");
      invalidate();
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const accountMutation = useMutation({
    mutationFn: async (): Promise<{ createdPassword?: string }> => {
      if (!accountModal) return {};
      if (accountModal.mode === "create") {
        const result = await apiFetch<{ initialPassword: string }>(
          `/suppliers/${supplierId}/accounts`,
          {
            method: "POST",
            body: JSON.stringify({
              name: accountForm.name,
              username: accountForm.username,
              email: accountForm.email,
              phone: accountForm.phone || null,
              title: accountForm.title || null,
            }),
          },
        );
        return { createdPassword: result.initialPassword };
      }
      await apiFetch(`/supplier-accounts/${accountModal.account?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: accountForm.name,
          phone: accountForm.phone || null,
          title: accountForm.title || null,
        }),
      });
      return {};
    },
    onSuccess: (result) => {
      setAccountModal(null);
      setAccountError(null);
      if (result.createdPassword) {
        setCreatedPassword(result.createdPassword);
      } else {
        setNotice("账号信息已更新");
      }
      invalidate();
    },
    onError: (error) => setAccountError(errorMessage(error)),
  });

  const accountStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/supplier-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      setNotice("账号状态已更新");
      invalidate();
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const accountResetMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/supplier-accounts/${id}/reset-password`, { method: "POST" }),
    onSuccess: () => setNotice("重置密码邮件已发送"),
    onError: (error) => setNotice(errorMessage(error)),
  });

  const accountDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/supplier-accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice("账号已停用并隐藏");
      invalidate();
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  const ratingMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/suppliers/${supplierId}/ratings`, {
        method: "POST",
        body: JSON.stringify({
          inquiryId: ratingForm.inquiryId,
          quoteQuality: Number(ratingForm.quoteQuality),
          responseSpeed: Number(ratingForm.responseSpeed),
          serviceAttitude: Number(ratingForm.serviceAttitude),
          comment: ratingForm.comment || null,
        }),
      }),
    onSuccess: () => {
      setRatingOpen(false);
      setRatingError(null);
      setNotice("评价已保存");
      invalidate();
    },
    onError: (error) => setRatingError(errorMessage(error)),
  });

  const visibilityMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/suppliers/${supplierId}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({
          visibilityScope: visibilityForm.scope,
          visibilityUserIds:
            visibilityForm.scope === "SPECIFIED" ? visibilityForm.userIds : [],
        }),
      }),
    onSuccess: () => {
      setVisibilityOpen(false);
      setVisibilityError(null);
      setNotice("可见范围已更新");
      invalidate();
    },
    onError: (error) => setVisibilityError(errorMessage(error)),
  });

  if (detailQuery.isLoading) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {detailQuery.error ? errorMessage(detailQuery.error) : "供应商不存在"}
      </p>
    );
  }

  const supplier = detailQuery.data;
  const status = supplierStatusMeta[supplier.status];
  const visibility = visibilityMeta[supplier.visibilityScope];

  function openCreateAccount() {
    setAccountForm({ name: "", username: "", email: "", phone: "", title: "" });
    setAccountError(null);
    setAccountModal({ mode: "create" });
  }

  function openEditAccount(account: Account) {
    setAccountForm({
      name: account.name,
      username: account.username,
      email: account.email,
      phone: account.phone ?? "",
      title: account.title ?? "",
    });
    setAccountError(null);
    setAccountModal({ mode: "edit", account });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <nav className="text-xs text-slate-500">
          <Link href="/suppliers" className="hover:text-blue-600">
            供应商
          </Link>
          <span className="mx-1">/</span>
          <span>{supplier.name}</span>
        </nav>
        <PageHeader
          title={supplier.name}
          description={`${supplier.code}${supplier.category ? ` · ${supplier.category}` : ""}`}
          actions={
            <>
              <StatusChip tone={status.tone}>{status.label}</StatusChip>
              <StatusChip tone="amber">
                ★ {Number(supplier.ratingAvg).toFixed(1)}（{supplier.ratingCount}）
              </StatusChip>
              {supplier.canManage ? (
                <>
                  <Link
                    href={`/suppliers/${supplier.id}/edit`}
                    className={secondaryButtonClass}
                  >
                    编辑
                  </Link>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={openCreateAccount}
                  >
                    新建账号
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      const next =
                        supplier.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
                      if (
                        window.confirm(
                          next === "DISABLED"
                            ? "确认停用该供应商？停用后不可被邀请参与新的询价。"
                            : "确认启用该供应商？",
                        )
                      ) {
                        statusMutation.mutate(next);
                      }
                    }}
                  >
                    {supplier.status === "ACTIVE" ? "停用" : "启用"}
                  </button>
                </>
              ) : null}
            </>
          }
        />
      </div>

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

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-slate-400">主营类别</p>
          <p className="mt-1 text-slate-800">{supplier.category ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">可见范围</p>
          <p className="mt-1">
            <StatusChip tone={visibility.tone}>{visibility.label}</StatusChip>
            {supplier.visibilityScope === "SPECIFIED"
              ? ` ${supplier.visibilityUsers.length} 人`
              : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">税号</p>
          <p className="mt-1 text-slate-800">{supplier.taxId ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">创建时间</p>
          <p className="mt-1 text-slate-800">{formatDateTime(supplier.createdAt)}</p>
        </div>
        {supplier.address || supplier.website || supplier.remark ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-slate-400">补充信息</p>
            <p className="mt-1 text-slate-700">
              {[supplier.address, supplier.website, supplier.remark]
                .filter(Boolean)
                .join(" · ") || "-"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
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

        {tab === "accounts" ? (
          <div className="overflow-x-auto">
            {supplier.accounts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400">
                暂无账号
                {supplier.canManage ? "，点击右上角「新建账号」添加。" : "。"}
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">姓名</th>
                    <th className="px-4 py-3 font-medium">用户名</th>
                    <th className="px-4 py-3 font-medium">邮箱</th>
                    <th className="px-4 py-3 font-medium">职位</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">最近登录</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplier.accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {account.name}
                        {account.isPrimary ? (
                          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                            主账号
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{account.username}</td>
                      <td className="px-4 py-3 text-slate-600">{account.email}</td>
                      <td className="px-4 py-3 text-slate-600">{account.title ?? "-"}</td>
                      <td className="px-4 py-3">
                        <StatusChip tone={account.isActive ? "green" : "neutral"}>
                          {account.isActive ? "启用" : "已停用"}
                        </StatusChip>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(account.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        {supplier.canManage ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => openEditAccount(account)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `确认向 ${account.email} 发送重置密码邮件？`,
                                  )
                                ) {
                                  accountResetMutation.mutate(account.id);
                                }
                              }}
                            >
                              重置密码
                            </button>
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() =>
                                accountStatusMutation.mutate({
                                  id: account.id,
                                  isActive: !account.isActive,
                                })
                              }
                            >
                              {account.isActive ? "停用" : "启用"}
                            </button>
                            <button
                              type="button"
                              className={dangerButtonClass}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `确认删除账号 ${account.username}？删除后不可恢复。`,
                                  )
                                ) {
                                  accountDeleteMutation.mutate(account.id);
                                }
                              }}
                            >
                              删除
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {tab === "ratings" ? (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span>
                  报价质量 <strong>{Number(supplier.ratingAvg).toFixed(1)}</strong>
                </span>
                <span>评价数 {supplier.ratingCount}</span>
              </div>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setRatingForm({
                    inquiryId: supplier.cooperation.quotes[0]?.inquiry.id ?? "",
                    quoteQuality: 5,
                    responseSpeed: 5,
                    serviceAttitude: 5,
                    comment: "",
                  });
                  setRatingError(null);
                  setRatingOpen(true);
                }}
              >
                评价
              </button>
            </div>
            {supplier.ratings.length === 0 ? (
              <p className="text-sm text-slate-400">暂无评价</p>
            ) : (
              <div className="space-y-3">
                {supplier.ratings.map((rating) => (
                  <div
                    key={rating.id}
                    className="rounded-xl border border-slate-200 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">
                        {rating.ratedByName ?? "内部用户"} · 综合{" "}
                        {Number(rating.score).toFixed(1)}
                      </p>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(rating.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      报价质量 {rating.quoteQuality} · 响应速度{" "}
                      {rating.responseSpeed} · 服务态度 {rating.serviceAttitude}
                    </p>
                    {rating.comment ? (
                      <p className="mt-2 text-slate-600">{rating.comment}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "cooperation" ? (
          <div className="space-y-6 p-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                参与的询价
              </h3>
              {supplier.cooperation.quotes.length === 0 ? (
                <p className="text-sm text-slate-400">暂无报价记录</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">项目</th>
                        <th className="px-3 py-2 font-medium">询价项</th>
                        <th className="px-3 py-2 font-medium">报价金额</th>
                        <th className="px-3 py-2 font-medium">提交时间</th>
                        <th className="px-3 py-2 font-medium">结果</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplier.cooperation.quotes.map((quote) => (
                        <tr key={quote.id}>
                          <td className="px-3 py-2 text-slate-700">
                            {quote.inquiry.project.name}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/projects/${quote.inquiry.project.id}/inquiries/${quote.inquiry.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {quote.inquiry.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">
                            {formatMoney(quote.totalPrice, quote.currency)}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {formatDateTime(quote.submittedAt)}
                          </td>
                          <td className="px-3 py-2">
                            {quote.inquiry.order ? (
                              <Link
                                href={`/orders/${quote.inquiry.order.id}`}
                                className="text-xs text-emerald-600 hover:underline"
                              >
                                已中标 · {quote.inquiry.order.orderNo}
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">未中标</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">订单</h3>
              {supplier.cooperation.orders.length === 0 ? (
                <p className="text-sm text-slate-400">暂无订单</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">订单号</th>
                        <th className="px-3 py-2 font-medium">项目</th>
                        <th className="px-3 py-2 font-medium">金额</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">创建时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplier.cooperation.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-3 py-2">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {order.orderNo}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {order.project.name}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">
                            {formatMoney(order.amount, order.currency)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{order.status}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {formatDateTime(order.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "visibility" ? (
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  当前范围：
                  <StatusChip tone={visibility.tone}>{visibility.label}</StatusChip>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  创建者与管理员始终可见。
                </p>
              </div>
              {supplier.canManage ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => {
                    setVisibilityForm({
                      scope: supplier.visibilityScope,
                      userIds: supplier.visibilityUsers.map((item) => item.id),
                    });
                    setVisibilityError(null);
                    setVisibilityOpen(true);
                  }}
                >
                  修改可见范围
                </button>
              ) : null}
            </div>

            {supplier.visibilityScope === "SPECIFIED" ? (
              supplier.visibilityUsers.length === 0 ? (
                <p className="text-sm text-slate-400">未配置指定用户</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {supplier.visibilityUsers.map((user) => (
                    <li key={user.id} className="px-4 py-2 text-sm text-slate-700">
                      {user.name ?? user.id}
                      {user.email ? (
                        <span className="ml-2 text-xs text-slate-400">
                          {user.email}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-slate-500">全体内部用户均可查看该供应商。</p>
            )}
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(accountModal)}
        title={accountModal?.mode === "create" ? "新建账号" : "编辑账号"}
        description={
          accountModal?.mode === "create"
            ? "系统将生成一次性初始密码并发送账号邮件。"
            : "账号密码请通过「重置密码」修改。"
        }
        onClose={() => setAccountModal(null)}
        footer={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setAccountModal(null)}
            >
              取消
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={accountMutation.isPending}
              onClick={() => accountMutation.mutate()}
            >
              {accountMutation.isPending ? "保存中…" : "保存"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="account-name">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              id="account-name"
              className={`${inputClass} mt-1`}
              value={accountForm.name}
              onChange={(event) =>
                setAccountForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="account-username">
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                id="account-username"
                className={`${inputClass} mt-1`}
                disabled={accountModal?.mode === "edit"}
                value={accountForm.username}
                onChange={(event) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="account-email">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <input
                id="account-email"
                type="email"
                className={`${inputClass} mt-1`}
                disabled={accountModal?.mode === "edit"}
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="account-phone">
                手机
              </label>
              <input
                id="account-phone"
                className={`${inputClass} mt-1`}
                value={accountForm.phone}
                onChange={(event) =>
                  setAccountForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="account-title">
                职位
              </label>
              <input
                id="account-title"
                className={`${inputClass} mt-1`}
                value={accountForm.title}
                onChange={(event) =>
                  setAccountForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
          </div>
          {accountError ? <p className={errorClass}>{accountError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(createdPassword)}
        title="账号已创建"
        description="请妥善保管初始密码，首次登录后必须修改。"
        onClose={() => setCreatedPassword(null)}
        footer={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setCreatedPassword(null)}
          >
            知道了
          </button>
        }
      >
        <p className="text-sm text-slate-700">
          初始密码：
          <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono">
            {createdPassword}
          </span>
        </p>
      </Modal>

      <Modal
        open={ratingOpen}
        title="评价供应商"
        description="评分范围 1–5 分，综合分为三项平均。"
        onClose={() => setRatingOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setRatingOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={ratingMutation.isPending || !ratingForm.inquiryId}
              onClick={() => ratingMutation.mutate()}
            >
              {ratingMutation.isPending ? "保存中…" : "保存评价"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="rating-inquiry">
              关联询价 <span className="text-red-500">*</span>
            </label>
            <select
              id="rating-inquiry"
              className={`${inputClass} mt-1`}
              value={ratingForm.inquiryId}
              onChange={(event) =>
                setRatingForm((prev) => ({
                  ...prev,
                  inquiryId: event.target.value,
                }))
              }
            >
              <option value="">请选择</option>
              {supplier.cooperation.quotes.map((quote) => (
                <option key={quote.id} value={quote.inquiry.id}>
                  {quote.inquiry.project.name} · {quote.inquiry.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["quoteQuality", "报价质量"],
                ["responseSpeed", "响应速度"],
                ["serviceAttitude", "服务态度"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`rating-${key}`}>
                  {label}
                </label>
                <select
                  id={`rating-${key}`}
                  className={`${inputClass} mt-1`}
                  value={ratingForm[key]}
                  onChange={(event) =>
                    setRatingForm((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} 分
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className={labelClass} htmlFor="rating-comment">
              评论
            </label>
            <textarea
              id="rating-comment"
              rows={3}
              className={`${inputClass} mt-1`}
              value={ratingForm.comment}
              onChange={(event) =>
                setRatingForm((prev) => ({ ...prev, comment: event.target.value }))
              }
            />
          </div>
          {ratingError ? <p className={errorClass}>{ratingError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={visibilityOpen}
        title="修改可见范围"
        onClose={() => setVisibilityOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setVisibilityOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={visibilityMutation.isPending}
              onClick={() => visibilityMutation.mutate()}
            >
              {visibilityMutation.isPending ? "保存中…" : "保存"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={visibilityForm.scope === "ALL"}
                onChange={() =>
                  setVisibilityForm((prev) => ({ ...prev, scope: "ALL" }))
                }
              />
              全员可见
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={visibilityForm.scope === "SPECIFIED"}
                onChange={() =>
                  setVisibilityForm((prev) => ({ ...prev, scope: "SPECIFIED" }))
                }
              />
              指定用户
            </label>
          </div>
          {visibilityForm.scope === "SPECIFIED" ? (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {directoryQuery.isLoading ? (
                <p className="text-xs text-slate-400">加载用户…</p>
              ) : (
                (directoryQuery.data ?? []).map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibilityForm.userIds.includes(user.id)}
                      onChange={() =>
                        setVisibilityForm((prev) => ({
                          ...prev,
                          userIds: prev.userIds.includes(user.id)
                            ? prev.userIds.filter((id) => id !== user.id)
                            : [...prev.userIds, user.id],
                        }))
                      }
                    />
                    {user.name}
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </label>
                ))
              )}
            </div>
          ) : null}
          {visibilityError ? <p className={errorClass}>{visibilityError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
