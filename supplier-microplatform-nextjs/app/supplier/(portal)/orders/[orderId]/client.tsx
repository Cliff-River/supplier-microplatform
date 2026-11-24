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
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
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

export function SupplierOrderDetailClient({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contractNote, setContractNote] = useState("");
  const [contractFiles, setContractFiles] = useState<UploadedFile[]>([]);
  const [acceptanceFiles, setAcceptanceFiles] = useState<UploadedFile[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: "",
    amount: "",
    note: "",
  });
  const [invoiceFiles, setInvoiceFiles] = useState<UploadedFile[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<UploadedFile[]>([]);

  const detailQuery = useQuery({
    queryKey: ["supplier-order", orderId],
    queryFn: () => apiFetch<OrderDetail>(`/supplier/orders/${orderId}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["supplier-order", orderId] });
    queryClient.invalidateQueries({ queryKey: ["supplier-orders"] });
    queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
  };

  const contractMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/supplier/orders/${orderId}/contract`, {
        method: "POST",
        body: JSON.stringify({
          note: contractNote || null,
          attachmentIds: contractFiles.map((file) => file.id),
        }),
      }),
    onSuccess: () => {
      setContractNote("");
      setContractFiles([]);
      setError(null);
      setNotice("合同已提交，等待采购方审核");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const acceptanceMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/supplier/orders/${orderId}/acceptance`, {
        method: "POST",
        body: JSON.stringify({
          attachmentIds: acceptanceFiles.map((file) => file.id),
        }),
      }),
    onSuccess: () => {
      setAcceptanceFiles([]);
      setError(null);
      setNotice("验收单已上传，等待采购方签署");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const invoiceMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>(`/supplier/orders/${orderId}/invoices`, {
        method: "POST",
        body: JSON.stringify({
          invoiceNo: invoiceForm.invoiceNo,
          amount: Number(invoiceForm.amount),
          note: invoiceForm.note || null,
          invoiceFileIds: invoiceFiles.map((file) => file.id),
          paymentRequestFileIds: paymentFiles.map((file) => file.id),
        }),
      }),
    onSuccess: () => {
      setInvoiceForm({ invoiceNo: "", amount: "", note: "" });
      setInvoiceFiles([]);
      setPaymentFiles([]);
      setError(null);
      setNotice("发票已提交");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const order = detailQuery.data;
  if (detailQuery.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {errorMessage(detailQuery.error)}
      </p>
    );
  }
  if (!order) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  const status = orderStatusMeta[order.status];
  const contractMeta = order.contract
    ? contractStatusMeta[order.contract.status]
    : null;
  const acceptanceMeta = order.acceptance
    ? acceptanceStatusMeta[order.acceptance.status]
    : null;
  const cancelled = order.status === "CANCELLED";
  const canSubmitContract =
    !cancelled &&
    !!order.contract &&
    ["PENDING_SUBMISSION", "RETURNED"].includes(order.contract.status);
  const canUploadAcceptance =
    !cancelled && order.acceptance?.status !== "SIGNED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`订单 ${order.orderNo}`}
        description={`${order.project.name}（${order.project.code}）· ${order.inquiry.title}`}
        actions={
          <Link href="/supplier/orders" className={secondaryButtonClass}>
            返回订单列表
          </Link>
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
            {status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}
            <span className="text-lg font-semibold tabular-nums text-slate-900">
              {formatMoney(order.amount, order.currency)}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">项目</dt>
              <dd className="mt-1 text-slate-800">{order.project.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">询价项</dt>
              <dd className="mt-1 text-slate-800">{order.inquiry.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">下单时间</dt>
              <dd className="mt-1 text-slate-800">
                {formatDateTime(order.createdAt)}
              </dd>
            </div>
            {order.completedAt ? (
              <div>
                <dt className="text-xs text-slate-400">完成时间</dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(order.completedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm font-medium text-slate-800">采购方联系人</p>
          <p className="text-sm text-slate-700">{order.project.contactName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {order.project.contactEmail}
          </p>
          {order.project.contactPhone ? (
            <p className="mt-1 text-xs text-slate-500">
              {order.project.contactPhone}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">合同</h2>
          {contractMeta ? (
            <StatusChip tone={contractMeta.tone}>{contractMeta.label}</StatusChip>
          ) : null}
        </div>

        {order.contract && order.contract.files.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {order.contract.files.map((file) => (
              <li key={file.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">
                    {file.attachment?.fileName ?? "文件"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {file.direction === "SUPPLIER" ? "我方提交" : "采购方回传"} ·{" "}
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
          <p className="text-xs text-slate-400">暂无合同文件。</p>
        )}

        {canSubmitContract ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <p className="text-sm font-medium text-slate-800">
              {order.contract!.status === "RETURNED"
                ? "按采购方修订意见重新提交合同"
                : "提交合同"}
            </p>
            <div>
              <label className={labelClass} htmlFor="contract-note">
                说明
              </label>
              <textarea
                id="contract-note"
                className={`${inputClass} mt-1 min-h-16`}
                value={contractNote}
                onChange={(event) => setContractNote(event.target.value)}
              />
            </div>
            <AttachmentField
              files={contractFiles}
              onChange={setContractFiles}
              label="合同文件 *"
            />
            <button
              type="button"
              className={primaryButtonClass}
              disabled={contractMutation.isPending}
              onClick={() => {
                setError(null);
                setNotice(null);
                if (!contractFiles.length) {
                  setError("请上传合同文件");
                  return;
                }
                contractMutation.mutate();
              }}
            >
              {contractMutation.isPending ? "提交中…" : "提交合同"}
            </button>
          </div>
        ) : null}

        {order.contract?.status === "SUBMITTED" ? (
          <p className="text-xs text-slate-400">合同已提交，等待采购方审核。</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">验收单</h2>
          {acceptanceMeta ? (
            <StatusChip tone={acceptanceMeta.tone}>
              {acceptanceMeta.label}
            </StatusChip>
          ) : (
            <span className="text-xs text-slate-400">未上传</span>
          )}
        </div>

        {order.acceptance ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-400">
                我方上传（{formatDateTime(order.acceptance.uploadedAt)}）
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
                采购方签署版
                {order.acceptance.signedAt
                  ? `（${formatDateTime(order.acceptance.signedAt)}）`
                  : ""}
              </p>
              <AttachmentList
                attachments={
                  order.acceptance.signedFile
                    ? [order.acceptance.signedFile]
                    : []
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

        {canUploadAcceptance ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <p className="text-sm font-medium text-slate-800">
              {order.acceptance ? "重新上传验收单" : "上传验收单"}
            </p>
            <AttachmentField
              files={acceptanceFiles}
              onChange={setAcceptanceFiles}
              label="验收单文件 *"
            />
            <button
              type="button"
              className={primaryButtonClass}
              disabled={acceptanceMutation.isPending}
              onClick={() => {
                setError(null);
                setNotice(null);
                if (!acceptanceFiles.length) {
                  setError("请上传验收单文件");
                  return;
                }
                acceptanceMutation.mutate();
              }}
            >
              {acceptanceMutation.isPending ? "上传中…" : "上传验收单"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">发票 / 请款</h2>
          <p className="text-xs text-slate-400">
            本期仅记录提交信息，系统不校验金额与发票号。
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

        {!cancelled ? (
          <div className="space-y-3 border-t border-slate-100 px-4 py-4">
            <p className="text-sm font-medium text-slate-800">提交发票信息</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="invoice-no">
                  发票号 *
                </label>
                <input
                  id="invoice-no"
                  className={`${inputClass} mt-1`}
                  value={invoiceForm.invoiceNo}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      invoiceNo: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="invoice-amount">
                  金额（元）*
                </label>
                <input
                  id="invoice-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={invoiceForm.amount}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="invoice-note">
                备注
              </label>
              <textarea
                id="invoice-note"
                className={`${inputClass} mt-1 min-h-16`}
                value={invoiceForm.note}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
              />
            </div>
            <AttachmentField
              files={invoiceFiles}
              onChange={setInvoiceFiles}
              label="发票文件（可选）"
            />
            <AttachmentField
              files={paymentFiles}
              onChange={setPaymentFiles}
              label="请款材料（可选）"
            />
            <button
              type="button"
              className={primaryButtonClass}
              disabled={invoiceMutation.isPending}
              onClick={() => {
                setError(null);
                setNotice(null);
                if (!invoiceForm.invoiceNo.trim()) {
                  setError("请填写发票号");
                  return;
                }
                if (invoiceForm.amount === "") {
                  setError("请填写发票金额");
                  return;
                }
                invoiceMutation.mutate();
              }}
            >
              {invoiceMutation.isPending ? "提交中…" : "提交发票"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
