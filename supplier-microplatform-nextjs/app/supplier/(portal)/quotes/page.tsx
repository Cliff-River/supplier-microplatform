"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip, inquiryStatusMeta } from "@/components/ui/status-chip";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";

interface QuoteHistoryRow {
  id: string;
  unitPrice: string | number;
  totalPrice: string | number;
  currency: string;
  deliveryDays: number | null;
  validUntil: string | null;
  note: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
  inquiry: {
    id: string;
    code: string;
    title: string;
    status: string;
    deadline: string;
    project: { id: string; name: string; code: string };
    order: { id: string; orderNo: string; status: string } | null;
  };
}

export default function SupplierQuotesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-quote-history"],
    queryFn: () => apiFetch<QuoteHistoryRow[]>("/supplier/quote-history"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的报价"
        description="贵司提交过的报价记录（只读，含最新版本与对应询价状态）。"
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage(error)}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          暂无报价记录。
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">询价项</th>
                <th className="px-4 py-3 font-medium">报价</th>
                <th className="px-4 py-3 font-medium">交期</th>
                <th className="px-4 py-3 font-medium">版本</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.map((quote) => {
                const meta = inquiryStatusMeta[quote.inquiry.status];
                return (
                  <tr key={quote.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/supplier/inquiries/${quote.inquiry.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {quote.inquiry.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-400">
                        {quote.inquiry.project.name} · {quote.inquiry.code}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {meta ? (
                          <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                        ) : null}
                        {quote.inquiry.order ? (
                          <span className="text-xs text-slate-500">
                            订单 {quote.inquiry.order.orderNo}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium tabular-nums text-slate-800">
                        {formatMoney(quote.totalPrice, quote.currency)}
                      </p>
                      <p className="text-xs text-slate-400">
                        单价 {formatMoney(quote.unitPrice, quote.currency)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {quote.deliveryDays === null
                        ? "-"
                        : `${quote.deliveryDays} 天`}
                      {quote.validUntil ? (
                        <p className="text-xs text-slate-400">
                          有效期至 {quote.validUntil}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      v{quote.version}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(quote.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
