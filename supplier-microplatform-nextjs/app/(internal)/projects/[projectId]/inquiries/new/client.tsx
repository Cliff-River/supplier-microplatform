"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AttachmentField,
  type UploadedFile,
} from "@/components/attachments/attachments";
import { PageHeader } from "@/components/ui/page-header";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage, type ListResult } from "@/lib/api-client";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  canManage: boolean;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
  category: string | null;
  ratingAvg: string | number;
}

function defaultDeadline(): string {
  const date = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function NewInquiryClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    quantity: "1",
    unit: "件",
    deadline: defaultDeadline(),
  });
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${projectId}`),
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: () =>
      apiFetch<ListResult<SupplierOption>>(
        "/suppliers?pageSize=100&status=ACTIVE",
      ),
  });

  const suppliers = useMemo(() => {
    const keyword = supplierSearch.trim().toLowerCase();
    const rows = suppliersQuery.data?.items ?? [];
    if (!keyword) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(keyword) ||
        row.code.toLowerCase().includes(keyword),
    );
  }, [suppliersQuery.data, supplierSearch]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/projects/${projectId}/inquiries`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          quantity: Number(form.quantity),
          unit: form.unit,
          deadline: new Date(form.deadline).toISOString(),
          invitedSupplierIds: selectedSupplierIds,
          attachmentIds: files.map((file) => file.id),
        }),
      }),
    onSuccess: (created) =>
      router.replace(`/projects/${projectId}/inquiries/${created.id}`),
    onError: (submitError) => setError(errorMessage(submitError)),
  });

  if (projectQuery.error) {
    return <p className="text-sm text-red-600">{errorMessage(projectQuery.error)}</p>;
  }
  if (!projectQuery.data) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }
  if (!projectQuery.data.canManage || projectQuery.data.status === "ARCHIVED") {
    return <p className="text-sm text-slate-500">该项目不可编辑。</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新增询价项"
        description={`${projectQuery.data.name} · 创建后需发送询价，供应商才可报价`}
      />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!form.title.trim()) return setError("请填写询价项标题");
          if (!(Number(form.quantity) > 0)) return setError("数量必须大于 0");
          if (!form.deadline) return setError("请选择报价截止时间");
          mutation.mutate();
        }}
      >
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="inquiry-title">
              询价项标题 *
            </label>
            <input
              id="inquiry-title"
              className={`${inputClass} mt-1`}
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="inquiry-quantity">
              数量 *
            </label>
            <input
              id="inquiry-quantity"
              type="number"
              min="0"
              step="0.001"
              className={`${inputClass} mt-1`}
              value={form.quantity}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, quantity: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="inquiry-unit">
              单位 *
            </label>
            <input
              id="inquiry-unit"
              className={`${inputClass} mt-1`}
              value={form.unit}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, unit: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="inquiry-deadline">
              报价截止时间 *
            </label>
            <input
              id="inquiry-deadline"
              type="datetime-local"
              className={`${inputClass} mt-1`}
              value={form.deadline}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deadline: event.target.value }))
              }
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="inquiry-description">
              询价要求
            </label>
            <textarea
              id="inquiry-description"
              className={`${inputClass} mt-1 min-h-24`}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <AttachmentField files={files} onChange={setFiles} />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className={labelClass}>
              受邀供应商（已选 {selectedSupplierIds.length} 家）
            </span>
            <input
              className={`${inputClass} h-9 w-56`}
              placeholder="搜索供应商"
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {suppliers.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400">暂无可用供应商。</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {suppliers.map((supplier) => (
                  <li key={supplier.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.includes(supplier.id)}
                        onChange={() =>
                          setSelectedSupplierIds((prev) =>
                            prev.includes(supplier.id)
                              ? prev.filter((row) => row !== supplier.id)
                              : [...prev, supplier.id],
                          )
                        }
                      />
                      <span className="flex-1">
                        <span className="font-medium text-slate-800">
                          {supplier.name}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          {supplier.code}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">
                        评级 {Number(supplier.ratingAvg).toFixed(1)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-400">
            创建后为草稿状态，进入详情页点击「发送询价」后供应商才可查看与报价。
          </p>
        </section>

        {error ? <p className={errorClass}>{error}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "创建中…" : "创建询价项"}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
