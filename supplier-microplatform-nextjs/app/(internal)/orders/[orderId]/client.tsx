"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  AttachmentField,
  AttachmentList,
  type AttachmentRow,
  type UploadedFile,
} from "@/components/attachments/attachments";
import { PageHeader } from "@/components/ui/page-header";
import {
  StatusChip,
  acceptanceStatusMeta,
  contractStatusMeta,
  orderStatusMeta,
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

interface ContractFileRow {
  id: string;
  attachmentId: string;
  direction: string;
  note: string | null;
  uploadedByType: string;
  createdAt: string;
  attachment: AttachmentRow | null;
}

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  amount: string | number;
  currency: string;
  note: string | null;
  createdAt: string;
  attachments: AttachmentRow[];
}

interface OrderDetail {
  id: string;
  orderNo: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  creatorName: string | null;
  project: {
    id: string;
    name: string;
    code: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
  };
  inquiry: { id: string; title: string };
  supplier: { id: string; name: string };
  contract: {
    id: string;
    status: string;
    supplierNote: string | null;
    submittedAt: string | null;
    returnedAt: string | null;
    completedAt: string | null;
    files: ContractFileRow[];
  } | null;
  acceptance: {
    id: string;
    status: string;
    uploadedAt: string;
    signedAt: string | null;
    supplierFile: AttachmentRow | null;
    signedFile: AttachmentRow | null;
  } | null;
  invoices: InvoiceRow[];
}

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnFiles, setReturnFiles] = useState<UploadedFile[]>([]);
  const [showSign, setShowSign] = useState(false);
  const [signFiles, setSignFiles] = useState<UploadedFile[]>([]);

  const detailQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${orderId}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: "complete" | "cancel") => {
      if (action === "cancel") {
        if (!window.confirm("取消后订单不可恢复，确认取消？")) return null;
        return apiFetch<OrderDetail>(`/orders/${orderId}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: null }),
        });
      }
      return apiFetch<OrderDetail>(`/orders/${orderId}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      setError(null);
      setNotice("操作已完成");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const completeContractMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/orders/${orderId}/contract/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setError(null);
      setNotice("合同已标记完成，订单进入履约中");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/orders/${orderId}/contract/return`, {
        method: "POST",
        body: JSON.stringify({
          note: returnNote || null,
          attachmentIds: returnFiles.map((file) => file.id),
        }),
      }),
    onSuccess: () => {
      setShowReturn(false);
      setReturnNote("");
      setReturnFiles([]);
      setError(null);
      setNotice("修订版合同已回传，系统已通知供应商");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const signMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/orders/${orderId}/acceptance/sign`, {
        method: "POST",
        body: JSON.stringify({
          signedFileId: signFiles[0]?.id ?? null,
        }),
      }),
    onSuccess: () => {
      setShowSign(false);
      setSignFiles([]);
      setError(null);
      setNotice("验收单已签署");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const order = detailQuery.data;
  if (detailQuery.error) {
    return <p className="text-sm text-red-600">{errorMessage(detailQuery.error)}</p>;
  }
  if (!order) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  const status = orderStatusMeta[order.status];
  const contract = order.contract
    ? contractStatusMeta[order.contract.status]
    : null;
  const acceptance = order.acceptance
    ? acceptanceStatusMeta[order.acceptance.status]
    : null;
  const canOperate = ["PENDING_CONTRACT", "IN_PROGRESS"].includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`订单 ${order.orderNo}`}
        description={`${order.project.name}（${order.project.code}）· ${order.inquiry.title}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${order.project.id}`}
              className={secondaryButtonClass}
            >
              返回项目
            </Link>
            {canOperate ? (
              <>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    if (!window.confirm("确认订单履约已完成？完成后仍可签署验收单。")) {
                      return;
                    }
                    setError(null);
                    actionMutation.mutate("complete");
                  }}
                >
                  标记订单完成
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setError(null);
                    actionMutation.mutate("cancel");
                  }}
                >
                  取消订单
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip tone={status.tone}>{status.label}</StatusChip>
            <span className="text-lg font-semibold tabular-nums text-slate-900">
              {formatMoney(order.amount, order.currency)}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">供应商</dt>
              <dd className="mt-1 text-slate-800">{order.supplier.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">项目</dt>
              <dd className="mt-1">
                <Link
                  href={`/projects/${order.project.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {order.project.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">询价项</dt>
              <dd className="mt-1">
                <Link
                  href={`/projects/${order.project.id}/inquiries/${order.inquiry.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {order.inquiry.title}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">创建时间 / 创建人</dt>
              <dd className="mt-1 text-slate-800">
                {formatDateTime(order.createdAt)} · {order.creatorName ?? "-"}
              </dd>
            </div>
            {order.completedAt ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">完成时间</dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(order.completedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm font-medium text-slate-800">项目联系人</p>
          <p className="text-sm text-slate-700">{order.project.contactName}</p>
          <p className="mt-1 text-xs text-slate-500">{order.project.contactEmail}</p>
          {order.project.contactPhone ? (
            <p className="mt-1 text-xs text-slate-500">{order.project.contactPhone}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">合同</h2>
            {contract ? (
              <StatusChip tone={contract.tone}>{contract.label}</StatusChip>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {order.contract?.status === "SUBMITTED" ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setShowReturn((prev) => !prev)}
              >
                回传修订版合同
              </button>
            ) : null}
            {order.contract &&
            ["SUBMITTED", "RETURNED"].includes(order.contract.status) ? (
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={completeContractMutation.isPending}
                onClick={() => {
                  if (!window.confirm("确认合同已完成线下签署？")) return;
                  setError(null);
                  completeContractMutation.mutate();
                }}
              >
                标记合同完成
              </button>
            ) : null}
          </div>
        </div>

        {showReturn ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">回传修订版合同</p>
            <div>
              <label className={labelClass} htmlFor="return-note">
                内部备注
              </label>
              <textarea
                id="return-note"
                className={`${inputClass} mt-1 min-h-16`}
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
              />
            </div>
            <AttachmentField
              files={returnFiles}
              onChange={setReturnFiles}
              label="修订版合同文件 *"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={returnMutation.isPending}
                onClick={() => {
                  setError(null);
                  if (!returnFiles.length) return setError("请上传修订版合同文件");
                  returnMutation.mutate();
                }}
              >
                确认回传
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setShowReturn(false)}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        {order.contract && order.contract.files.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {order.contract.files.map((file) => (
              <li key={file.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">
                    {file.attachment?.fileName ?? "文件"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {file.direction === "SUPPLIER" ? "供应商提交" : "内部回传"} ·{" "}
                    {formatDateTime(file.createdAt)}
                  </span>
                </div>
                {file.note ? (
                  <p className="mt-1 text-xs text-slate-500">备注：{file.note}</p>
                ) : null}
                {file.attachment ? (
                  <div className="mt-1">
                    <AttachmentList attachments={[file.attachment]} emptyText="" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">
            暂无合同文件，等待供应商提交。
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">验收单</h2>
            {acceptance ? (
              <StatusChip tone={acceptance.tone}>{acceptance.label}</StatusChip>
            ) : (
              <span className="text-xs text-slate-400">供应商未上传</span>
            )}
          </div>
          {order.acceptance?.status === "UPLOADED" ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setShowSign((prev) => !prev)}
            >
              签署验收单
            </button>
          ) : null}
        </div>

        {showSign ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">签署验收单</p>
            <AttachmentField
              files={signFiles}
              onChange={setSignFiles}
              label="签署版验收单（可选）"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={signMutation.isPending}
                onClick={() => {
                  setError(null);
                  signMutation.mutate();
                }}
              >
                确认签署
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setShowSign(false)}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        {order.acceptance ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-400">
                供应商上传（{formatDateTime(order.acceptance.uploadedAt)}）
              </p>
              <AttachmentList
                attachments={
                  order.acceptance.supplierFile
                    ? [order.acceptance.supplierFile]
                    : []
                }
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-400">
                签署版
                {order.acceptance.signedAt
                  ? `（${formatDateTime(order.acceptance.signedAt)}）`
                  : ""}
              </p>
              <AttachmentList
                attachments={
                  order.acceptance.signedFile ? [order.acceptance.signedFile] : []
                }
                emptyText={
                  order.acceptance.status === "SIGNED" ? "未上传签署版" : "待签署"
                }
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            验收单为可选项，不阻塞订单完成。
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">发票 / 请款</h2>
          <p className="text-xs text-slate-400">
            本期仅记录提交信息，系统不校验金额与发票号重复。
          </p>
        </div>
        {order.invoices.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            暂无发票记录
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {order.invoices.map((invoice) => (
              <li key={invoice.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">
                    {invoice.invoiceNo}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(invoice.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatMoney(invoice.amount, invoice.currency)}
                </p>
                {invoice.note ? (
                  <p className="mt-1 text-xs text-slate-500">{invoice.note}</p>
                ) : null}
                {invoice.attachments.length ? (
                  <div className="mt-2">
                    <AttachmentList attachments={invoice.attachments} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {order.status !== "CANCELLED" ? (
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            供应商可在供应商端继续提交发票与请款材料。
            <button
              type="button"
              className={`${smallButtonClass} ml-2`}
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["order", orderId] })
              }
            >
              刷新
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
