"use client";

import { Button, Input } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset, type AuthKind } from "@/lib/auth";

export function ForgotPasswordForm({ kind }: { kind: AuthKind }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loginHref = kind === "internal" ? "/login" : "/supplier/login";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(
        kind,
        email.trim(),
        `${window.location.origin}${
          kind === "internal" ? "/reset-password" : "/supplier/reset-password"
        }`,
      );
      setSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "发送失败，请重试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          如果该邮箱已注册，我们已发送重置密码链接，请查收邮件（1 小时内有效）。
        </div>
        <Link
          href={loginHref}
          className="block text-center text-sm font-medium text-blue-600"
        >
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          邮箱
        </label>
        <Input
          id="email"
          type="email"
          placeholder="请输入账号绑定邮箱"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          fullWidth
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        isDisabled={submitting}
      >
        {submitting ? "发送中…" : "发送重置链接"}
      </Button>

      <Link
        href={loginHref}
        className="block text-center text-xs font-medium text-slate-500"
      >
        返回登录
      </Link>
    </form>
  );
}
