"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  acceptanceStatusMeta,
  contractStatusMeta,
  orderStatusMeta,
} from "@/components/ui/status-chip";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";

interface SupplierOrderRow {
  id: string;
  orderNo: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  project: { id: string; name: string; code: string };
  inquiry: { id: string; title: string };
  contractStatus: string | null;
  acceptanceStatus: string | null;
  invoiceCount: number;
}

export default function SupplierOrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-orders"],
    queryFn: () => apiFetch<ListResult<SupplierOrderRow>>("/supplier/orders"),
  });

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的订单"
        description="查看中选订单，提交合同、验收单与发票材料。"
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage(error)}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          暂无订单。
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((order) => {
            const orderMeta = orderStatusMeta[order.status];
            const contractMeta = order.contractStatus
              ? contractStatusMeta[order.contractStatus]
              : null;
            const acceptanceMeta = order.acceptanceStatus
              ? acceptanceStatusMeta[order.acceptanceStatus]
              : null;
            return (
              <li
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {order.project.name}
                      </p>
                      {orderMeta ? (
                        <StatusChip tone={orderMeta.tone}>
                          {orderMeta.label}
                        </StatusChip>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.orderNo} · {order.inquiry.title} · 下单{" "}
                      {formatDateTime(order.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {contractMeta ? (
                        <StatusChip tone={contractMeta.tone}>
                          {contractMeta.label}
                        </StatusChip>
                      ) : null}
                      {acceptanceMeta ? (
                        <StatusChip tone={acceptanceMeta.tone}>
                          {acceptanceMeta.label}
                        </StatusChip>
                      ) : (
                        <span>验收单未上传</span>
                      )}
                      <span>发票 {order.invoiceCount} 张</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <p className="text-base font-semibold tabular-nums text-slate-900">
                      {formatMoney(order.amount, order.currency)}
                    </p>
                    <Link
                      href={`/supplier/orders/${order.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      查看详情与提交材料
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
