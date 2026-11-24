"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  errorClass,
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { apiFetch } from "@/lib/api-client";

const schema = z
  .object({
    name: z.string().trim().min(1, "请输入供应商名称").max(100, "名称过长"),
    code: z.string().trim().max(40, "编码过长").optional(),
    shortName: z.string().trim().max(50, "简称过长").optional(),
    category: z.string().trim().max(50, "类别过长").optional(),
    address: z.string().trim().max(200, "地址过长").optional(),
    website: z.string().trim().max(200, "网址过长").optional(),
    taxId: z.string().trim().max(50, "税号过长").optional(),
    remark: z.string().trim().max(1000, "备注过长").optional(),
    visibilityScope: z.enum(["ALL", "SPECIFIED"]),
    visibilityUserIds: z.array(z.string()),
    accountEnabled: z.boolean().optional(),
    accountName: z.string().optional(),
    accountUsername: z.string().optional(),
    accountEmail: z.string().optional(),
    accountPhone: z.string().optional(),
    accountTitle: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.visibilityScope === "SPECIFIED" && values.visibilityUserIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["visibilityUserIds"],
        message: "指定可见范围时至少选择 1 个用户",
      });
    }
    if (values.accountEnabled) {
      if (!values.accountName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["accountName"],
          message: "请输入账号姓名",
        });
      }
      if (!values.accountUsername || values.accountUsername.trim().length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["accountUsername"],
          message: "用户名至少 3 个字符",
        });
      }
      if (!values.accountEmail || !z.email().safeParse(values.accountEmail).success) {
        ctx.addIssue({
          code: "custom",
          path: ["accountEmail"],
          message: "邮箱格式不正确",
        });
      }
    }
  });

export type SupplierFormValues = z.infer<typeof schema>;

export interface SupplierFormInitial {
  name?: string;
  code?: string;
  shortName?: string | null;
  category?: string | null;
  address?: string | null;
  website?: string | null;
  taxId?: string | null;
  remark?: string | null;
  visibilityScope?: "ALL" | "SPECIFIED";
  visibilityUserIds?: string[];
}

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}

export function SupplierForm({
  mode,
  initial,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: SupplierFormInitial;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      shortName: initial?.shortName ?? "",
      category: initial?.category ?? "",
      address: initial?.address ?? "",
      website: initial?.website ?? "",
      taxId: initial?.taxId ?? "",
      remark: initial?.remark ?? "",
      visibilityScope: initial?.visibilityScope ?? "ALL",
      visibilityUserIds: initial?.visibilityUserIds ?? [],
      accountEnabled: false,
    },
  });

  useEffect(() => {
    reset({
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      shortName: initial?.shortName ?? "",
      category: initial?.category ?? "",
      address: initial?.address ?? "",
      website: initial?.website ?? "",
      taxId: initial?.taxId ?? "",
      remark: initial?.remark ?? "",
      visibilityScope: initial?.visibilityScope ?? "ALL",
      visibilityUserIds: initial?.visibilityUserIds ?? [],
      accountEnabled: false,
    });
  }, [initial, reset]);

  const directory = useQuery({
    queryKey: ["internal-directory"],
    queryFn: () => apiFetch<DirectoryUser[]>("/internal-users"),
  });

  // react-hook-form 的 watch 无法被 React Compiler 安全缓存，此处仅用于条件渲染。
  // eslint-disable-next-line react-hooks/incompatible-library
  const visibilityScope = watch("visibilityScope");
  const selectedUsers = watch("visibilityUserIds") ?? [];
  const accountEnabled = watch("accountEnabled");

  function toggleUser(id: string) {
    const next = selectedUsers.includes(id)
      ? selectedUsers.filter((item) => item !== id)
      : [...selectedUsers, id];
    setValue("visibilityUserIds", next, { shouldValidate: true });
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-5 lg:col-span-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">企业信息</h3>
          <div>
            <label className={labelClass} htmlFor="supplier-name">
              供应商名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-name"
              className={`${inputClass} mt-1`}
              {...register("name")}
            />
            {errors.name ? <p className={errorClass}>{errors.name.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="supplier-code">
                供应商编码
              </label>
              <input
                id="supplier-code"
                className={`${inputClass} mt-1`}
                placeholder={mode === "create" ? "留空自动生成" : undefined}
                {...register("code")}
              />
              {errors.code ? <p className={errorClass}>{errors.code.message}</p> : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-short">
                简称
              </label>
              <input
                id="supplier-short"
                className={`${inputClass} mt-1`}
                {...register("shortName")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="supplier-category">
                主营类别
              </label>
              <input
                id="supplier-category"
                className={`${inputClass} mt-1`}
                {...register("category")}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-tax">
                税号
              </label>
              <input
                id="supplier-tax"
                className={`${inputClass} mt-1`}
                {...register("taxId")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="supplier-address">
                地址
              </label>
              <input
                id="supplier-address"
                className={`${inputClass} mt-1`}
                {...register("address")}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier-website">
                官网
              </label>
              <input
                id="supplier-website"
                className={`${inputClass} mt-1`}
                placeholder="https://"
                {...register("website")}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="supplier-remark">
              备注
            </label>
            <textarea
              id="supplier-remark"
              rows={3}
              className={`${inputClass} mt-1`}
              {...register("remark")}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">可见范围</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" value="ALL" {...register("visibilityScope")} />
              全员可见
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                value="SPECIFIED"
                {...register("visibilityScope")}
              />
              指定用户
            </label>
          </div>

          {visibilityScope === "SPECIFIED" ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className={hintClass}>
                选择可见的内部用户（创建者与管理员始终可见）。
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {directory.isLoading ? (
                  <p className="text-xs text-slate-400">加载用户…</p>
                ) : (directory.data ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">暂无可用用户</p>
                ) : (
                  (directory.data ?? []).map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                      />
                      {user.name}
                      <span className="text-xs text-slate-400">{user.email}</span>
                    </label>
                  ))
                )}
              </div>
              {errors.visibilityUserIds ? (
                <p className={errorClass}>{errors.visibilityUserIds.message}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        {mode === "create" ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" {...register("accountEnabled")} />
              同时创建首个供应商账号
            </label>
            {accountEnabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="account-name">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="account-name"
                    className={`${inputClass} mt-1`}
                    {...register("accountName")}
                  />
                  {errors.accountName ? (
                    <p className={errorClass}>{errors.accountName.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="account-username">
                    用户名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="account-username"
                    className={`${inputClass} mt-1`}
                    {...register("accountUsername")}
                  />
                  {errors.accountUsername ? (
                    <p className={errorClass}>{errors.accountUsername.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="account-email">
                    邮箱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    className={`${inputClass} mt-1`}
                    {...register("accountEmail")}
                  />
                  {errors.accountEmail ? (
                    <p className={errorClass}>{errors.accountEmail.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="account-phone">
                    手机
                  </label>
                  <input
                    id="account-phone"
                    className={`${inputClass} mt-1`}
                    {...register("accountPhone")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="account-title">
                    职位
                  </label>
                  <input
                    id="account-title"
                    className={`${inputClass} mt-1`}
                    {...register("accountTitle")}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {serverError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </button>
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitting ? "保存中…" : mode === "create" ? "创建供应商" : "保存修改"}
          </button>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-900">说明</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-500">
            <li>编码留空时将按日期自动生成。</li>
            <li>「指定用户」创建后仍可随时调整可见范围。</li>
            <li>供应商账号的初始密码会自动生成并发送邮件。</li>
          </ul>
        </div>
      </aside>
    </form>
  );
}
