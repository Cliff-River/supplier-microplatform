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

export default function NewProjectClient() {
  const router = useRouter();
  const [project, setProject] = useState({
    name: "",
    customerName: "",
    description: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [inquiry, setInquiry] = useState({
    title: "",
    description: "",
    quantity: "1",
    unit: "件",
    deadline: defaultDeadline(),
  });
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [send, setSend] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        row.code.toLowerCase().includes(keyword) ||
        (row.category ?? "").toLowerCase().includes(keyword),
    );
  }, [suppliersQuery.data, supplierSearch]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string; createdInquiryId: string | null }>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: project.name,
          customerName: project.customerName || null,
          description: project.description || null,
          contactName: project.contactName,
          contactEmail: project.contactEmail,
          contactPhone: project.contactPhone || null,
          inquiry: {
            title: inquiry.title,
            description: inquiry.description || null,
            quantity: Number(inquiry.quantity),
            unit: inquiry.unit,
            deadline: new Date(inquiry.deadline).toISOString(),
            invitedSupplierIds: selectedSupplierIds,
            attachmentIds: files.map((file) => file.id),
          },
          send,
        }),
      }),
    onSuccess: (result) => {
      if (result.createdInquiryId) {
        router.replace(`/projects/${result.id}/inquiries/${result.createdInquiryId}`);
      } else {
        router.replace(`/projects/${result.id}`);
      }
    },
    onError: (submitError) => setError(errorMessage(submitError)),
  });

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建项目"
        description="填写项目与默认询价项，可立即向受邀供应商发送询价邮件。"
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!project.name.trim()) return setError("请填写项目名称");
          if (!project.contactName.trim()) return setError("请填写联系人姓名");
          if (!project.contactEmail.trim()) return setError("请填写联系人邮箱");
          if (!inquiry.title.trim()) return setError("请填写询价项标题");
          if (!(Number(inquiry.quantity) > 0)) return setError("数量必须大于 0");
          if (!inquiry.deadline) return setError("请选择报价截止时间");
          if (send && selectedSupplierIds.length === 0) {
            return setError("发送询价前至少选择 1 家供应商");
          }
          mutation.mutate();
        }}
      >
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">项目信息</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="project-name">
                项目名称 *
              </label>
              <input
                id="project-name"
                className={`${inputClass} mt-1`}
                value={project.name}
                onChange={(event) =>
                  setProject((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="project-customer">
                客户名称
              </label>
              <input
                id="project-customer"
                className={`${inputClass} mt-1`}
                value={project.customerName}
                onChange={(event) =>
                  setProject((prev) => ({
                    ...prev,
                    customerName: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="project-contact">
                联系人姓名 *
              </label>
              <input
                id="project-contact"
                className={`${inputClass} mt-1`}
                value={project.contactName}
                onChange={(event) =>
                  setProject((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="project-email">
                联系人邮箱 *
              </label>
              <input
                id="project-email"
                type="email"
                className={`${inputClass} mt-1`}
                value={project.contactEmail}
                onChange={(event) =>
                  setProject((prev) => ({
                    ...prev,
                    contactEmail: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="project-phone">
                联系人电话
              </label>
              <input
                id="project-phone"
                className={`${inputClass} mt-1`}
                value={project.contactPhone}
                onChange={(event) =>
                  setProject((prev) => ({
                    ...prev,
                    contactPhone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="project-description">
                项目说明
              </label>
              <textarea
                id="project-description"
                className={`${inputClass} mt-1 min-h-20`}
                value={project.description}
                onChange={(event) =>
                  setProject((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">默认询价项</h2>
            <span className="text-xs text-slate-400">
              创建后可继续新增多个询价项
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="inquiry-title">
                询价项标题 *
              </label>
              <input
                id="inquiry-title"
                className={`${inputClass} mt-1`}
                value={inquiry.title}
                onChange={(event) =>
                  setInquiry((prev) => ({ ...prev, title: event.target.value }))
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
                value={inquiry.quantity}
                onChange={(event) =>
                  setInquiry((prev) => ({
                    ...prev,
                    quantity: event.target.value,
                  }))
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
                value={inquiry.unit}
                onChange={(event) =>
                  setInquiry((prev) => ({ ...prev, unit: event.target.value }))
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
                value={inquiry.deadline}
                onChange={(event) =>
                  setInquiry((prev) => ({
                    ...prev,
                    deadline: event.target.value,
                  }))
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
                className={`${inputClass} mt-1 min-h-20`}
                value={inquiry.description}
                onChange={(event) =>
                  setInquiry((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <AttachmentField files={files} onChange={setFiles} />
            </div>
          </div>

          <div className="space-y-2">
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
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              {suppliersQuery.isLoading ? (
                <p className="px-3 py-4 text-xs text-slate-400">加载中…</p>
              ) : suppliers.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">
                  暂无可用供应商，请先在「供应商」中创建。
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {suppliers.map((supplier) => (
                    <li key={supplier.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedSupplierIds.includes(supplier.id)}
                          onChange={() => toggleSupplier(supplier.id)}
                        />
                        <span className="flex-1">
                          <span className="font-medium text-slate-800">
                            {supplier.name}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            {supplier.code}
                            {supplier.category ? ` · ${supplier.category}` : ""}
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
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={send}
              onChange={(event) => setSend(event.target.checked)}
            />
            创建后立即发送询价邮件（需至少选择 1 家供应商）
          </label>
        </section>

        {error ? <p className={errorClass}>{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "创建中…"
              : send
                ? "创建并发送询价"
                : "创建项目"}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => router.push("/projects")}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
