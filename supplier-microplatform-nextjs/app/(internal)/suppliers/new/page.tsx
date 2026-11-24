"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SupplierForm, type SupplierFormValues } from "@/components/suppliers/supplier-form";
import { PageHeader } from "@/components/ui/page-header";
import { apiFetch, errorMessage } from "@/lib/api-client";

export default function NewSupplierPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      apiFetch<{
        id: string;
        accountResult?: {
          status: "created" | "failed";
          message?: string;
          account?: { initialPassword?: string; username?: string };
        };
      }>("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          code: values.code?.trim() || undefined,
          shortName: values.shortName || null,
          category: values.category || null,
          address: values.address || null,
          website: values.website || null,
          taxId: values.taxId || null,
          remark: values.remark || null,
          visibilityScope: values.visibilityScope,
          visibilityUserIds:
            values.visibilityScope === "SPECIFIED"
              ? values.visibilityUserIds
              : undefined,
          account: values.accountEnabled
            ? {
                name: values.accountName,
                username: values.accountUsername,
                email: values.accountEmail,
                phone: values.accountPhone || null,
                title: values.accountTitle || null,
              }
            : undefined,
        }),
      }),
    onSuccess: (supplier) => {
      if (supplier.accountResult?.status === "failed") {
        const password = supplier.accountResult.account?.initialPassword;
        window.alert(
          `供应商已创建，但首个账号创建失败：${supplier.accountResult.message ?? "未知原因"}${
            password ? `\n初始密码：${password}` : ""
          }\n可在详情页重试创建账号。`,
        );
      }
      router.replace(`/suppliers/${supplier.id}`);
    },
    onError: (error) => setServerError(errorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建供应商"
        description="填写企业信息、可见范围，可同时创建首个供应商账号。"
      />
      <SupplierForm
        mode="create"
        submitting={mutation.isPending}
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          await mutation.mutateAsync(values);
        }}
        onCancel={() => router.push("/suppliers")}
      />
    </div>
  );
}
