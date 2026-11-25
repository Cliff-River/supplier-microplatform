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
import { StatusChip, inquiryStatusMeta } from "@/components/ui/status-chip";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  toDateInputValue,
} from "@/lib/format";

interface MyQuote {
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
  attachments: AttachmentRow[];
}

interface SupplierInquiryDetail {
  id: string;
  code: string;
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
  myQuote: MyQuote | null;
  attachments: AttachmentRow[];
  readOnly: boolean;
  canQuote: boolean;
  order: { id: string; orderNo: string; status: string } | null;
}

interface QuoteFormState {
  unitPrice: string;
  totalPrice: string;
  deliveryDays: string;
  validUntil: string;
  note: string;
}

export function SupplierInquiryDetailClient({
  inquiryId,
}: {
  inquiryId: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteFormState | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const detailQuery = useQuery({
    queryKey: ["supplier-inquiry", inquiryId],
    queryFn: () =>
      apiFetch<SupplierInquiryDetail>(`/supplier/inquiries/${inquiryId}`),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const inquiry = detailQuery.data;
  const currentForm: QuoteFormState =
    form ??
    (inquiry
      ? {
          unitPrice: inquiry.myQuote ? String(inquiry.myQuote.unitPrice) : "",
          totalPrice: inquiry.myQuote ? String(inquiry.myQuote.totalPrice) : "",
          deliveryDays:
            inquiry.myQuote?.deliveryDays !== null &&
            inquiry.myQuote?.deliveryDays !== undefined
              ? String(inquiry.myQuote.deliveryDays)
              : "",
          validUntil: inquiry.myQuote?.validUntil
            ? toDateInputValue(inquiry.myQuote.validUntil)
            : "",
          note: inquiry.myQuote?.note ?? "",
        }
      : {
          unitPrice: "",
          totalPrice: "",
          deliveryDays: "",
          validUntil: "",
          note: "",
        });

  function updateForm(patch: Partial<QuoteFormState>) {
    setForm({ ...currentForm, ...patch });
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/supplier/inquiries/${inquiryId}/quote`, {
        method: "PUT",
        body: JSON.stringify({
          unitPrice: Number(currentForm.unitPrice),
          totalPrice: currentForm.totalPrice
            ? Number(currentForm.totalPrice)
            : undefined,
          deliveryDays: currentForm.deliveryDays
            ? Number(currentForm.deliveryDays)
            : null,
          validUntil: currentForm.validUntil
            ? new Date(`${currentForm.validUntil}T00:00:00+08:00`).toISOString()
            : null,
          note: currentForm.note || null,
          attachmentIds: files.map((file) => file.id),
        }),
      }),
    onSuccess: () => {
      setError(null);
      setNotice("报价已提交，采购方已收到通知");
      setFiles([]);
      setForm(null);
      queryClient.invalidateQueries({
        queryKey: ["supplier-inquiry", inquiryId],
      });
      queryClient.invalidateQueries({ queryKey: ["supplier-inquiries"] });
      queryClient.invalidateQueries({
        queryKey: ["supplier-quote-history"],
      });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  if (detailQuery.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {errorMessage(detailQuery.error)}
      </p>
    );
  }

  if (!inquiry) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  const meta = inquiryStatusMeta[inquiry.status];

  return (
    <div className="space-y-6">
      <PageHeader
        title={inquiry.title}
        description={`${inquiry.project.name}（${inquiry.project.code}）· ${inquiry.code}`}
        actions={
          <Link href="/supplier/inquiries" className={secondaryButtonClass}>
            返回列表
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            {meta ? <StatusChip tone={meta.tone}>{meta.label}</StatusChip> : null}
            <span className="text-sm text-slate-500">
              需求 {formatNumber(inquiry.quantity)}
              {inquiry.unit}
            </span>
            <span className="text-sm text-slate-500">
              截止 {formatDateTime(inquiry.deadline)}
            </span>
          </div>
          {inquiry.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
              {inquiry.description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">采购方未填写补充说明。</p>
          )}
          <div className="mt-4">
            <p className="mb-1 text-xs text-slate-400">询价附件</p>
            <AttachmentList attachments={inquiry.attachments} />
          </div>
          {inquiry.order ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              该询价已定标，订单 {inquiry.order.orderNo} 已创建。
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm font-medium text-slate-800">采购方联系人</p>
          <p className="text-sm text-slate-700">{inquiry.project.contactName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {inquiry.project.contactEmail}
          </p>
          {inquiry.project.contactPhone ? (
            <p className="mt-1 text-xs text-slate-500">
              {inquiry.project.contactPhone}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">我的报价</h2>
          {inquiry.myQuote ? (
            <span className="text-xs text-slate-400">
              当前版本 v{inquiry.myQuote.version} · 更新于{" "}
              {formatDateTime(inquiry.myQuote.updatedAt)}
            </span>
          ) : null}
        </div>

        {inquiry.myQuote ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">含税总价</p>
                <p className="mt-1 font-medium tabular-nums text-slate-800">
                  {formatMoney(
                    inquiry.myQuote.totalPrice,
                    inquiry.myQuote.currency,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">单价</p>
                <p className="mt-1 tabular-nums text-slate-700">
                  {formatMoney(
                    inquiry.myQuote.unitPrice,
                    inquiry.myQuote.currency,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">交期</p>
                <p className="mt-1 text-slate-700">
                  {inquiry.myQuote.deliveryDays === null
                    ? "-"
                    : `${inquiry.myQuote.deliveryDays} 天`}
                </p>
              </div>
            </div>
            {inquiry.myQuote.note ? (
              <p className="mt-3 text-xs text-slate-500">
                备注：{inquiry.myQuote.note}
              </p>
            ) : null}
            {inquiry.myQuote.attachments.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 text-xs text-slate-400">报价附件</p>
                <AttachmentList attachments={inquiry.myQuote.attachments} />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-400">尚未提交报价。</p>
        )}

        {inquiry.readOnly ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            询价已结束，报价不可修改。
          </p>
        ) : !inquiry.canQuote ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            已超过报价截止时间，无法提交或修改报价。
          </p>
        ) : (
          <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <p className="text-sm font-medium text-slate-800">
              {inquiry.myQuote ? "修改报价（提交后版本 +1）" : "提交报价"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="quote-unit-price">
                  单价（元 / {inquiry.unit}）*
                </label>
                <input
                  id="quote-unit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={currentForm.unitPrice}
                  onChange={(event) =>
                    updateForm({ unitPrice: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="quote-total-price">
                  含税总价（元，留空自动计算）
                </label>
                <input
                  id="quote-total-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={currentForm.totalPrice}
                  onChange={(event) =>
                    updateForm({ totalPrice: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="quote-delivery">
                  交货天数
                </label>
                <input
                  id="quote-delivery"
                  type="number"
                  min="0"
                  step="1"
                  className={`${inputClass} mt-1`}
                  value={currentForm.deliveryDays}
                  onChange={(event) =>
                    updateForm({ deliveryDays: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="quote-valid-until">
                  报价有效期
                </label>
                <input
                  id="quote-valid-until"
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={currentForm.validUntil}
                  onChange={(event) =>
                    updateForm({ validUntil: event.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="quote-note">
                报价说明
              </label>
              <textarea
                id="quote-note"
                className={`${inputClass} mt-1 min-h-20`}
                value={currentForm.note}
                onChange={(event) => updateForm({ note: event.target.value })}
              />
            </div>
            <AttachmentField
              files={files}
              onChange={setFiles}
              label="报价附件（可选）"
            />
            <button
              type="button"
              className={primaryButtonClass}
              disabled={
                submitMutation.isPending || currentForm.unitPrice === ""
              }
              onClick={() => {
                setError(null);
                setNotice(null);
                if (!currentForm.unitPrice) {
                  setError("请填写单价");
                  return;
                }
                submitMutation.mutate();
              }}
            >
              {submitMutation.isPending
                ? "提交中…"
                : inquiry.myQuote
                  ? "提交修改"
                  : "提交报价"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
