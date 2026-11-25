"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AttachmentList,
  type AttachmentRow,
} from "@/components/attachments/attachments";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  inquiryStatusMeta,
  mailStatusMeta,
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
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  toDateTimeInputValue,
} from "@/lib/format";

interface InvitedSupplier {
  id: string;
  supplierId: string;
  mailStatus: string;
  mailError: string | null;
  sentAt: string | null;
  supplier: {
    id: string;
    name: string;
    code: string;
    ratingAvg: string | number;
    ratingCount: number;
    status: string;
  };
}

interface QuoteRow {
  id: string;
  supplierId: string;
  unitPrice: string | number;
  totalPrice: string | number;
  currency: string;
  deliveryDays: number | null;
  validUntil: string | null;
  note: string | null;
  version: number;
  submittedAt: string;
  isLowestTotal?: boolean;
  supplier: {
    id: string;
    name: string;
    code: string;
    ratingAvg: string | number;
  };
  attachments: AttachmentRow[];
}

interface InquiryDetail {
  id: string;
  code: string;
  projectId: string;
  title: string;
  description: string | null;
  quantity: string | number;
  unit: string;
  deadline: string;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  awardedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    code: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
  };
  invited: InvitedSupplier[];
  quotes: QuoteRow[];
  attachments: AttachmentRow[];
  order?: { id: string; orderNo: string; status: string } | null;
}

function defaultDeadline(): string {
  const date = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  return toDateTimeInputValue(date);
}

export function InquiryDetailClient({
  projectId,
  inquiryId,
}: {
  projectId: string;
  inquiryId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenDeadline, setReopenDeadline] = useState(defaultDeadline());
  const [reopenResend, setReopenResend] = useState(true);
  const [sortKey, setSortKey] = useState<
    "totalPrice" | "deliveryDays" | "ratingAvg"
  >("totalPrice");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const detailQuery = useQuery({
    queryKey: ["inquiry", inquiryId],
    queryFn: () => apiFetch<InquiryDetail>(`/inquiries/${inquiryId}`),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inquiry", inquiryId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: "send" | "close" | "cancel" | "resend") => {
      if (action === "send") {
        return apiFetch<{ sent: number; failed: number }>(
          `/inquiries/${inquiryId}/send`,
          { method: "POST", body: JSON.stringify({}) },
        );
      }
      if (action === "resend") {
        return apiFetch<{ sent: number; failed: number }>(
          `/inquiries/${inquiryId}/resend`,
          { method: "POST", body: JSON.stringify({}) },
        );
      }
      await apiFetch(`/inquiries/${inquiryId}/${action}`, { method: "POST" });
      return null;
    },
    onSuccess: (result, action) => {
      setError(null);
      if (result) {
        setNotice(`邮件发送完成：成功 ${result.sent} 家，失败 ${result.failed} 家`);
      } else {
        setNotice(action === "close" ? "询价已关闭" : "询价已作废");
      }
      refresh();
    },
    onError: (mutationError) => {
      setNotice(null);
      setError(errorMessage(mutationError));
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      apiFetch<InquiryDetail & { mailResult?: { sent: number; failed: number } }>(
        `/inquiries/${inquiryId}/reopen`,
        {
          method: "POST",
          body: JSON.stringify({
            deadline: new Date(reopenDeadline).toISOString(),
            resend: reopenResend,
          }),
        },
      ),
    onSuccess: (result) => {
      setShowReopen(false);
      setError(null);
      setNotice(
        result.mailResult
          ? `已重新开放，邮件成功 ${result.mailResult.sent} 家，失败 ${result.mailResult.failed} 家`
          : "已重新开放询价",
      );
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const awardMutation = useMutation({
    mutationFn: (supplierId: string) =>
      apiFetch<{ id: string }>(`/inquiries/${inquiryId}/award`, {
        method: "POST",
        body: JSON.stringify({ supplierId }),
      }),
    onSuccess: (order) => {
      refresh();
      router.push(`/orders/${order.id}`);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/inquiries/${inquiryId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      router.replace(`/projects/${projectId}`);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const inquiry = detailQuery.data;
  if (detailQuery.error) {
    return <p className="text-sm text-red-600">{errorMessage(detailQuery.error)}</p>;
  }
  if (!inquiry) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  const status = inquiryStatusMeta[inquiry.status];
  const minTotal = inquiry.quotes.length
    ? Math.min(...inquiry.quotes.map((quote) => Number(quote.totalPrice)))
    : null;
  const deliveryValues = inquiry.quotes
    .map((quote) => quote.deliveryDays)
    .filter((value): value is number => value != null);
  const minDelivery = deliveryValues.length ? Math.min(...deliveryValues) : null;
  const awardable = inquiry.status === "CLOSED";

  const sortedQuotes = [...inquiry.quotes].sort((a, b) => {
    const direction = sortDir === "asc" ? 1 : -1;
    if (sortKey === "totalPrice") {
      return (Number(a.totalPrice) - Number(b.totalPrice)) * direction;
    }
    if (sortKey === "deliveryDays") {
      if (a.deliveryDays == null && b.deliveryDays == null) return 0;
      if (a.deliveryDays == null) return 1;
      if (b.deliveryDays == null) return -1;
      return (a.deliveryDays - b.deliveryDays) * direction;
    }
    return (
      (Number(a.supplier.ratingAvg) - Number(b.supplier.ratingAvg)) * direction
    );
  });

  const toggleSort = (key: "totalPrice" | "deliveryDays" | "ratingAvg") => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "ratingAvg" ? "desc" : "asc");
  };

  const sortIndicator = (key: "totalPrice" | "deliveryDays" | "ratingAvg") =>
    sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={inquiry.title}
        description={`${inquiry.code} · ${inquiry.project.name}（${inquiry.project.code}）`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/projects/${projectId}`} className={secondaryButtonClass}>
              返回项目
            </Link>
            {inquiry.status === "DRAFT" ? (
              <>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setError(null);
                    actionMutation.mutate("send");
                  }}
                >
                  发送询价
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (!window.confirm("删除后不可恢复，确认删除该草稿询价项？")) {
                      return;
                    }
                    deleteMutation.mutate();
                  }}
                >
                  删除草稿
                </button>
              </>
            ) : null}
            {inquiry.status === "OPEN" ? (
              <>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setError(null);
                    actionMutation.mutate("close");
                  }}
                >
                  关闭询价
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setError(null);
                    actionMutation.mutate("resend");
                  }}
                >
                  重发询价邮件
                </button>
              </>
            ) : null}
            {inquiry.status === "CLOSED" ? (
              <>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => setShowReopen((prev) => !prev)}
                >
                  重新开放
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    if (!window.confirm("作废后不可恢复，确认作废？")) return;
                    setError(null);
                    actionMutation.mutate("cancel");
                  }}
                >
                  作废
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      ) : null}
      {error ? <p className={errorClass}>{error}</p> : null}

      {showReopen ? (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-sm font-medium text-slate-800">重新开放询价</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass} htmlFor="reopen-deadline">
                新的截止时间
              </label>
              <input
                id="reopen-deadline"
                type="datetime-local"
                className={`${inputClass} mt-1`}
                value={reopenDeadline}
                onChange={(event) => setReopenDeadline(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={reopenResend}
                onChange={(event) => setReopenResend(event.target.checked)}
              />
              同时重发询价邮件
            </label>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={reopenMutation.isPending}
              onClick={() => {
                setError(null);
                reopenMutation.mutate();
              }}
            >
              {reopenMutation.isPending ? "处理中…" : "确认重新开放"}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setShowReopen(false)}
            >
              取消
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <span className="text-sm text-slate-500">
              截止 {formatDateTime(inquiry.deadline)}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">数量</dt>
              <dd className="mt-1 text-slate-800">
                {formatNumber(inquiry.quantity)} {inquiry.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">报价数</dt>
              <dd className="mt-1 text-slate-800">{inquiry.quotes.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">联系人</dt>
              <dd className="mt-1 text-slate-800">
                {inquiry.project.contactName} · {inquiry.project.contactEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">受邀供应商</dt>
              <dd className="mt-1 text-slate-800">{inquiry.invited.length}</dd>
            </div>
            {inquiry.description ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">询价要求</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-700">
                  {inquiry.description}
                </dd>
              </div>
            ) : null}
          </dl>
          <div>
            <p className="mb-1 text-xs text-slate-400">询价附件</p>
            <AttachmentList attachments={inquiry.attachments} />
          </div>
          {inquiry.order ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              已生成订单{" "}
              <Link
                href={`/orders/${inquiry.order.id}`}
                className="font-medium underline"
              >
                {inquiry.order.orderNo}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-slate-800">受邀供应商</p>
          {inquiry.invited.length === 0 ? (
            <p className="text-xs text-slate-400">尚未选择供应商</p>
          ) : (
            <ul className="space-y-2">
              {inquiry.invited.map((invite) => {
                const mail = mailStatusMeta[invite.mailStatus];
                return (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="text-slate-800">{invite.supplier.name}</p>
                      <p className="text-xs text-slate-400">
                        {invite.supplier.code}
                        {invite.mailError ? ` · ${invite.mailError}` : ""}
                      </p>
                    </div>
                    <StatusChip tone={mail.tone}>{mail.label}</StatusChip>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">报价对比</h2>
            <p className="text-xs text-slate-400">
              可按总价、交期、评级排序，最低价与最短交期将高亮显示。
            </p>
          </div>
          {inquiry.quotes.length > 0 ? (
            <a
              href={`/api/inquiries/${inquiryId}/quotes/export`}
              className={secondaryButtonClass}
            >
              导出 Excel
            </a>
          ) : null}
        </div>

        {inquiry.quotes.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            暂无报价
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">供应商</th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("ratingAvg")}
                    >
                      评级 {sortIndicator("ratingAvg")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">单价</th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("totalPrice")}
                    >
                      总价 {sortIndicator("totalPrice")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("deliveryDays")}
                    >
                      交期 {sortIndicator("deliveryDays")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">有效期</th>
                  <th className="px-4 py-3 font-medium">版本 / 时间</th>
                  <th className="px-4 py-3 font-medium">报价附件</th>
                  {awardable ? (
                    <th className="px-4 py-3 font-medium">操作</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedQuotes.map((quote) => {
                  const isLowest =
                    minTotal !== null && Number(quote.totalPrice) === minTotal;
                  const isFastest =
                    minDelivery !== null && quote.deliveryDays === minDelivery;
                  return (
                    <tr
                      key={quote.id}
                      className={isLowest ? "bg-emerald-50/50" : "hover:bg-slate-50"}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {quote.supplier.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {quote.supplier.code}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {Number(quote.supplier.ratingAvg).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {formatMoney(quote.unitPrice, quote.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium tabular-nums text-slate-800">
                          {formatMoney(quote.totalPrice, quote.currency)}
                        </span>
                        {isLowest ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            最低价
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {quote.deliveryDays != null
                          ? `${quote.deliveryDays} 天`
                          : "-"}
                        {isFastest ? (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            最快
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {quote.validUntil ? formatDateTime(quote.validUntil) : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        v{quote.version}
                        <br />
                        {formatDateTime(quote.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <AttachmentList
                          attachments={quote.attachments}
                          emptyText="无"
                        />
                      </td>
                      {awardable ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className={smallButtonClass}
                            disabled={awardMutation.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `确认选定「${quote.supplier.name}」并生成订单？选标后不可撤销。`,
                                )
                              ) {
                                return;
                              }
                              setError(null);
                              awardMutation.mutate(quote.supplierId);
                            }}
                          >
                            选定并生成订单
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {inquiry.quotes.some((quote) => quote.note) ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-2 text-xs text-slate-400">报价说明</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {inquiry.quotes
                .filter((quote) => quote.note)
                .map((quote) => (
                  <li key={quote.id}>
                    <span className="font-medium">{quote.supplier.name}：</span>
                    {quote.note}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
