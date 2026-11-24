"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

interface Overview {
  user: { name: string; role: "ADMIN" | "MEMBER" };
  stats: {
    activeProjects: number;
    openInquiries: number;
    inProgressOrders: number;
    pendingContracts: number;
    pendingAcceptance: number;
  };
  recentProjects: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  closingInquiries: Array<{
    id: string;
    code: string;
    title: string;
    deadline: string;
    project: { id: string; name: string };
    _count: { quotes: number };
  }>;
}

const statCards: Array<{
  key: keyof Overview["stats"];
  label: string;
  hint: string;
  href: string;
}> = [
  { key: "activeProjects", label: "进行中的项目", hint: "全部活跃项目", href: "/projects" },
  { key: "openInquiries", label: "开放中的询价", hint: "等待供应商报价", href: "/projects" },
  { key: "inProgressOrders", label: "履约中的订单", hint: "含待提交合同", href: "/orders" },
  { key: "pendingContracts", label: "待提交合同", hint: "等待供应商上传", href: "/orders" },
];

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => apiFetch<Overview>("/dashboard/overview"),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
          Overview
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          工作台概览
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          查看项目与询价进展、订单履约与待办事项。
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
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {isLoading ? "…" : (data?.stats[card.key] ?? 0)}
            </p>
            <p className="mt-2 text-xs text-slate-400 group-hover:text-blue-600">
              {card.hint}
            </p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">最近项目</h3>
            <Link href="/projects" className="text-xs text-blue-600">
              查看全部
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
            ) : data && data.recentProjects.length > 0 ? (
              data.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {project.name}
                    </p>
                    <p className="text-xs text-slate-400">{project.code}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(project.createdAt)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-400">
                暂无项目，前往「项目与询价」创建第一个项目。
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">
              临近截止的询价
            </h3>
            <Link href="/projects" className="text-xs text-blue-600">
              查看全部
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <p className="px-5 py-6 text-sm text-slate-400">加载中…</p>
            ) : data && data.closingInquiries.length > 0 ? (
              data.closingInquiries.map((inquiry) => (
                <Link
                  key={inquiry.id}
                  href={`/projects/${inquiry.project.id}/inquiries/${inquiry.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {inquiry.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {inquiry.project.name} · {inquiry._count.quotes} 份报价
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    截止 {formatDateTime(inquiry.deadline)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-slate-400">
                暂无开放中的询价。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
