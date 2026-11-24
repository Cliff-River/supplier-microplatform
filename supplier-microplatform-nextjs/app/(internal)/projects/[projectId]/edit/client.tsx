"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch, errorMessage } from "@/lib/api-client";

interface ProjectDetail {
  id: string;
  name: string;
  customerName: string | null;
  description: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  status: string;
  canManage: boolean;
}

export function EditProjectClient({ projectId }: { projectId: string }) {

  const detailQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${projectId}`),
  });

  if (detailQuery.error) {
    return (
      <p className="text-sm text-red-600">{errorMessage(detailQuery.error)}</p>
    );
  }
  if (!detailQuery.data) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }
  if (!detailQuery.data.canManage || detailQuery.data.status === "ARCHIVED") {
    return (
      <p className="text-sm text-slate-500">
        该项目不可编辑（非创建者或已归档）。
      </p>
    );
  }

  return (
    <EditProjectForm projectId={projectId} project={detailQuery.data} />
  );
}

function EditProjectForm({
  projectId,
  project,
}: {
  projectId: string;
  project: ProjectDetail;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: project.name,
    customerName: project.customerName ?? "",
    description: project.description ?? "",
    contactName: project.contactName,
    contactEmail: project.contactEmail,
    contactPhone: project.contactPhone ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<ProjectDetail>(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          customerName: form.customerName || null,
          description: form.description || null,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || null,
        }),
      }),
    onSuccess: () => router.replace(`/projects/${projectId}`),
    onError: (submitError) => setError(errorMessage(submitError)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="编辑项目" description={project.name} />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!form.name.trim()) return setError("请填写项目名称");
          if (!form.contactName.trim()) return setError("请填写联系人姓名");
          if (!form.contactEmail.trim()) return setError("请填写联系人邮箱");
          mutation.mutate();
        }}
      >
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="edit-name">
              项目名称 *
            </label>
            <input
              id="edit-name"
              className={`${inputClass} mt-1`}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-customer">
              客户名称
            </label>
            <input
              id="edit-customer"
              className={`${inputClass} mt-1`}
              value={form.customerName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, customerName: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-contact">
              联系人姓名 *
            </label>
            <input
              id="edit-contact"
              className={`${inputClass} mt-1`}
              value={form.contactName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactName: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-email">
              联系人邮箱 *
            </label>
            <input
              id="edit-email"
              type="email"
              className={`${inputClass} mt-1`}
              value={form.contactEmail}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-phone">
              联系人电话
            </label>
            <input
              id="edit-phone"
              className={`${inputClass} mt-1`}
              value={form.contactPhone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactPhone: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="edit-description">
              项目说明
            </label>
            <textarea
              id="edit-description"
              className={`${inputClass} mt-1 min-h-24`}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
        </section>

        {error ? <p className={errorClass}>{error}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "保存中…" : "保存"}
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
