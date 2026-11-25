"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";

interface Overview {
  stats: {
    openInvitations: number;
    myQuotes: number;
    activeOrders: number;
    pendingContracts: number;
  };
  recentOrders: Array<{
    id: string;
    orderNo: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
    project: { name: string };
  }>;
}

const statCards: Array<{
  key: keyof Overview["stats"];
  label: string;
  href: string;
}> = [
  { key: "openInvitations", label: "开放中的邀请", href: "/supplier/inquiries" },
  { key: "myQuotes", label: "已提交报价", href: "/supplier/quotes" },
  { key: "activeOrders", label: "履约中订单", href: "/supplier/orders" },
  { key: "pendingContracts", label: "待提交合同", href: "/supplier/orders" },
];

export default function SupplierDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-dashboard"],
    queryFn: () => apiFetch<Overview>("/supplier/dashboard/overview"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
          Supplier Workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          供应商工作台
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          查看采购方邀请的询价、报价提交与订单履约进度。
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error instanceof Error ? error.message : "加载失败"}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {isLoading ? "…" : (data?.stats[card.key] ?? 0)}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">最近订单</h3>
          <Link href="/supplier/orders" className="text-xs text-blue-600">
            查看全部
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
          ) : data && data.recentOrders.length > 0 ? (
            data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/supplier/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {order.project.name}
                  </p>
                  <p className="text-xs text-slate-400">{order.orderNo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">
                    {formatMoney(order.amount, order.currency)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="px-5 py-6 text-sm text-slate-400">暂无订单。</p>
          )}
        </div>
      </section>
    </div>
  );
}
