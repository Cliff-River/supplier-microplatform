"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SupplierForm, type SupplierFormValues } from "@/components/suppliers/supplier-form";
import { PageHeader } from "@/components/ui/page-header";
import { apiFetch, errorMessage } from "@/lib/api-client";

interface SupplierDetail {
  id: string;
  name: string;
  code: string;
  shortName: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
  remark: string | null;
  visibilityScope: "ALL" | "SPECIFIED";
  canManage: boolean;
  visibilityUsers: Array<{ id: string }>;
}

export function EditSupplierClient({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => apiFetch<SupplierDetail>(`/suppliers/${supplierId}`),
  });

  const mutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      apiFetch(`/suppliers/${supplierId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          code: values.code?.trim() || undefined,
          shortName: values.shortName || null,
          category: values.category || null,
          address: values.address || null,
          website: values.website || null,
          taxId: values.taxId || null,
          remark: values.remark || null,
        }),
      }),
    onError: (error) => setServerError(errorMessage(error)),
  });

  const visibilityMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      apiFetch(`/suppliers/${supplierId}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({
          visibilityScope: values.visibilityScope,
          visibilityUserIds:
            values.visibilityScope === "SPECIFIED"
              ? values.visibilityUserIds
              : [],
        }),
      }),
    onError: (error) => setServerError(errorMessage(error)),
  });

  if (detailQuery.isLoading) {
    return <p className="text-sm text-slate-400">加载中…</p>;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {detailQuery.error ? errorMessage(detailQuery.error) : "供应商不存在"}
      </p>
    );
  }

  const supplier = detailQuery.data;

  if (!supplier.canManage) {
    return (
      <div className="space-y-4">
        <PageHeader title="编辑供应商" />
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          仅管理员或创建者可编辑该供应商。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`编辑供应商 · ${supplier.name}`}
        description="修改企业信息与可见范围。"
      />
      <SupplierForm
        mode="edit"
        initial={{
          name: supplier.name,
          code: supplier.code,
          shortName: supplier.shortName ?? "",
          category: supplier.category ?? "",
          address: supplier.address ?? "",
          website: supplier.website ?? "",
          taxId: supplier.taxId ?? "",
          remark: supplier.remark ?? "",
          visibilityScope: supplier.visibilityScope,
          visibilityUserIds: supplier.visibilityUsers.map((item) => item.id),
        }}
        submitting={mutation.isPending || visibilityMutation.isPending}
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            await mutation.mutateAsync(values);
            await visibilityMutation.mutateAsync(values);
            router.replace(`/suppliers/${supplierId}`);
          } catch {
            // 错误信息已由 mutation 的 onError 设置
          }
        }}
        onCancel={() => router.push(`/suppliers/${supplierId}`)}
      />
    </div>
  );
}
