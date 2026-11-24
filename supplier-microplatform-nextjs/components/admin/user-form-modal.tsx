"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Modal } from "@/components/ui/modal";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";

const baseSchema = {
  name: z.string().trim().min(1, "请输入姓名").max(50, "姓名过长"),
  phone: z.string().trim().max(30, "手机号过长").optional(),
  role: z.enum(["ADMIN", "MEMBER"]),
};

const createSchema = z.object({
  ...baseSchema,
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(30, "用户名最多 30 个字符")
    .regex(/^[a-zA-Z0-9_.-]+$/, "仅支持字母、数字、下划线、点和横线"),
  email: z.email("邮箱格式不正确"),
});

export type UserFormValues = z.infer<typeof createSchema>;

export function UserFormModal({
  open,
  mode,
  initial,
  submitting,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<UserFormValues>;
  submitting: boolean;
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: initial?.name ?? "",
      username: initial?.username ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      role: initial?.role ?? "MEMBER",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? "",
      username: initial?.username ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      role: initial?.role ?? "MEMBER",
    });
  }, [initial, open, reset]);

  const isCreate = mode === "create";

  return (
    <Modal
      open={open}
      title={isCreate ? "新建内部用户" : "编辑内部用户"}
      description={
        isCreate
          ? "系统将生成一次性初始密码并通过邮件发送，首次登录需修改密码。"
          : "编辑不会修改密码，如需重置请使用「重置密码」。"
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            form="user-form"
            className={primaryButtonClass}
            disabled={submitting}
          >
            {submitting ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <form
        id="user-form"
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          await onSubmit({
            ...values,
            phone: values.phone?.trim() ? values.phone.trim() : undefined,
          });
        })}
        noValidate
      >
        <div>
          <label className={labelClass} htmlFor="user-name">
            姓名 <span className="text-red-500">*</span>
          </label>
          <input id="user-name" className={`${inputClass} mt-1`} {...register("name")} />
          {errors.name ? <p className={errorClass}>{errors.name.message}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="user-username">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              id="user-username"
              className={`${inputClass} mt-1`}
              disabled={!isCreate}
              {...register("username")}
            />
            {errors.username ? (
              <p className={errorClass}>{errors.username.message}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="user-email">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              id="user-email"
              type="email"
              className={`${inputClass} mt-1`}
              disabled={!isCreate}
              {...register("email")}
            />
            {errors.email ? (
              <p className={errorClass}>{errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="user-phone">
              手机号
            </label>
            <input
              id="user-phone"
              className={`${inputClass} mt-1`}
              {...register("phone")}
            />
            {errors.phone ? (
              <p className={errorClass}>{errors.phone.message}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="user-role">
              角色
            </label>
            <select
              id="user-role"
              className={`${inputClass} mt-1`}
              {...register("role")}
            >
              <option value="MEMBER">普通用户</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
        </div>

        {serverError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
