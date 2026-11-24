"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { secondaryButtonClass } from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";

interface SupplierInquiryRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  quantity: string | number;
  unit: string;
  deadline: string;
  status: string;
  openedAt: string | null;
  createdAt: string;
  invitedCount: number;
  myQuote: { id: string; version: number; submittedAt: string } | null;
}

type SupplierInquiryView = SupplierInquiryRow & { expired: boolean };

export default function SupplierInquiriesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-inquiries"],
    queryFn: async () => {
      const rows = await apiFetch<SupplierInquiryRow[]>("/supplier/inquiries");
      const now = Date.now();
      return rows.map((row) => ({
        ...row,
        expired: new Date(row.deadline).getTime() <= now,
      })) satisfies SupplierInquiryView[];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="邀请询价"
        description="采购方发送给贵司的开放询价，可在截止时间前提交或修改报价。"
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
          暂无开放中的询价邀请。
        </div>
      ) : (
        <ul className="space-y-3">
          {data!.map((inquiry) => {
            const expired = inquiry.expired;
            return (
              <li
                key={inquiry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {inquiry.title}
                      </p>
                      <StatusChip tone={expired ? "amber" : "blue"}>
                        {expired ? "已截止" : "报价中"}
                      </StatusChip>
                      {inquiry.myQuote ? (
                        <StatusChip tone="green">
                          已报价 v{inquiry.myQuote.version}
                        </StatusChip>
                      ) : (
                        <StatusChip tone="neutral">未报价</StatusChip>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {inquiry.code} · {formatNumber(inquiry.quantity)}
                      {inquiry.unit} · 截止 {formatDateTime(inquiry.deadline)}
                    </p>
                    {inquiry.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        {inquiry.description}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/supplier/inquiries/${inquiry.id}`}
                    className={secondaryButtonClass}
                  >
                    查看详情
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
