"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  contractStatusMeta,
  inquiryStatusMeta,
  orderStatusMeta,
  projectStatusMeta,
  acceptanceStatusMeta,
} from "@/components/ui/status-chip";
import {
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";

interface InquiryRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  quantity: string | number;
  unit: string;
  deadline: string;
  status: string;
  invitedCount: number;
  quoteCount: number;
  order: { id: string; orderNo: string; status: string } | null;
}

interface OrderRow {
  id: string;
  orderNo: string;
  amount: string | number;
  currency: string;
  status: string;
  contractStatus: string | null;
  acceptanceStatus: string | null;
  invoiceCount: number;
  createdAt: string;
  supplier: { id: string; name: string };
}

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  amount: string | number;
  currency: string;
  note: string | null;
  createdAt: string;
  order: { id: string; orderNo: string };
}

interface ActivityRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string | null;
  actorName: string | null;
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  customerName: string | null;
  description: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  creatorName: string | null;
  canManage: boolean;
  inquiries: InquiryRow[];
  orders: OrderRow[];
  invoices: InvoiceRow[];
  activities: ActivityRow[];
}

const tabs = [
  { key: "inquiries", label: "询价项" },
  { key: "orders", label: "订单" },
  { key: "invoices", label: "发票" },
  { key: "activity", label: "动态" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("inquiries");
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${projectId}`),
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      apiFetch<ProjectDetail>(`/projects/${projectId}/archive`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const project = detailQuery.data;
  if (detailQuery.error) {
    return (
      <p className="text-sm text-red-600">{errorMessage(detailQuery.error)}</p>
    );
  }
  if (!project) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  const status = projectStatusMeta[project.status];
  const archived = project.status === "ARCHIVED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.code} · 创建于 ${formatDateTime(project.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/projects" className={secondaryButtonClass}>
              返回列表
            </Link>
            {project.canManage && !archived ? (
              <Link
                href={`/projects/${project.id}/edit`}
                className={secondaryButtonClass}
              >
                编辑项目
              </Link>
            ) : null}
            {project.canManage && !archived ? (
              <Link
                href={`/projects/${project.id}/inquiries/new`}
                className={primaryButtonClass}
              >
                新增询价项
              </Link>
            ) : null}
            {project.canManage && !archived ? (
              <button
                type="button"
                className={dangerButtonClass}
                disabled={archiveMutation.isPending}
                onClick={() => {
                  if (!window.confirm("归档后项目将只读，确认归档？")) return;
                  setActionError(null);
                  archiveMutation.mutate();
                }}
              >
                归档项目
              </button>
            ) : null}
          </div>
        }
      />

      {archived ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          项目已归档（{formatDateTime(project.archivedAt)}），仅可查看。
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-red-600">{actionError}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
          {project.customerName ? (
            <span className="text-sm text-slate-500">
              客户：{project.customerName}
            </span>
          ) : null}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">联系人</dt>
            <dd className="mt-1 text-slate-800">{project.contactName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">联系邮箱</dt>
            <dd className="mt-1 text-slate-800">{project.contactEmail}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">联系电话</dt>
            <dd className="mt-1 text-slate-800">
              {project.contactPhone ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">创建人</dt>
            <dd className="mt-1 text-slate-800">
              {project.creatorName ?? "-"}
            </dd>
          </div>
          {project.description ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs text-slate-400">项目说明</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-700">
                {project.description}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex gap-1 border-b border-slate-100 px-3 pt-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`rounded-t-lg px-4 py-2 text-sm ${
                tab === item.key
                  ? "border-b-2 border-blue-600 font-medium text-blue-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "inquiries" ? (
          project.inquiries.length === 0 ? (
            <EmptyState
              text="暂无询价项"
              action={
                project.canManage && !archived ? (
                  <Link
                    href={`/projects/${project.id}/inquiries/new`}
                    className={`${primaryButtonClass} mt-4`}
                  >
                    新增询价项
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">询价项</th>
                    <th className="px-4 py-3 font-medium">数量</th>
                    <th className="px-4 py-3 font-medium">截止时间</th>
                    <th className="px-4 py-3 font-medium">受邀 / 报价</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">订单</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.inquiries.map((inquiry) => {
                    const inquiryStatus = inquiryStatusMeta[inquiry.status];
                    return (
                      <tr key={inquiry.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${project.id}/inquiries/${inquiry.id}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {inquiry.title}
                          </Link>
                          <p className="text-xs text-slate-400">{inquiry.code}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {formatNumber(inquiry.quantity)} {inquiry.unit}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDateTime(inquiry.deadline)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {inquiry.invitedCount} / {inquiry.quoteCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={inquiryStatus.tone}>
                            {inquiryStatus.label}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {inquiry.order ? (
                            <Link
                              href={`/orders/${inquiry.order.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {inquiry.order.orderNo}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${project.id}/inquiries/${inquiry.id}`}
                            className={smallButtonClass}
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "orders" ? (
          project.orders.length === 0 ? (
            <EmptyState text="暂无订单" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">订单号</th>
                    <th className="px-4 py-3 font-medium">供应商</th>
                    <th className="px-4 py-3 font-medium">金额</th>
                    <th className="px-4 py-3 font-medium">合同</th>
                    <th className="px-4 py-3 font-medium">验收单</th>
                    <th className="px-4 py-3 font-medium">发票</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.orders.map((order) => {
                    const orderStatus = orderStatusMeta[order.status];
                    const contract = order.contractStatus
                      ? contractStatusMeta[order.contractStatus]
                      : null;
                    const acceptance = order.acceptanceStatus
                      ? acceptanceStatusMeta[order.acceptanceStatus]
                      : null;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {order.orderNo}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.supplier.name}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {formatMoney(order.amount, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {contract ? (
                            <StatusChip tone={contract.tone}>
                              {contract.label}
                            </StatusChip>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {acceptance ? (
                            <StatusChip tone={acceptance.tone}>
                              {acceptance.label}
                            </StatusChip>
                          ) : (
                            <span className="text-xs text-slate-400">未上传</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {order.invoiceCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={orderStatus.tone}>
                            {orderStatus.label}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className={smallButtonClass}
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "invoices" ? (
          project.invoices.length === 0 ? (
            <EmptyState text="暂无发票/请款记录" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">发票号</th>
                    <th className="px-4 py-3 font-medium">订单</th>
                    <th className="px-4 py-3 font-medium">金额</th>
                    <th className="px-4 py-3 font-medium">备注</th>
                    <th className="px-4 py-3 font-medium">提交时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {invoice.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <Link
                          href={`/orders/${invoice.order.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {invoice.order.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {invoice.note ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(invoice.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${invoice.order.id}`}
                          className={smallButtonClass}
                        >
                          查看订单
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "activity" ? (
          project.activities.length === 0 ? (
            <EmptyState text="暂无操作记录" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {project.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-slate-700">
                      {activity.summary ?? activity.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {activity.actorName ?? "系统"} · {activity.targetType}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(activity.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <div className="text-xs text-slate-400">
        最后更新：{formatDateTime(project.updatedAt)}
        {project.canManage ? " · 您是该项目的管理者" : null}
      </div>
    </div>
  );
}

function EmptyState({
  text,
  action,
}: {
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      {action}
    </div>
  );
}
