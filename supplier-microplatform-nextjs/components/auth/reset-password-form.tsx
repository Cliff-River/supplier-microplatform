"use client";

import { Button, Input } from "@heroui/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { resetPassword, type AuthKind } from "@/lib/auth";

export function ResetPasswordForm({ kind }: { kind: AuthKind }) {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loginHref = kind === "internal" ? "/login" : "/supplier/login";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // 从浏览器地址读取一次性 token，属于外部系统同步。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(params.get("token"));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("重置链接无效，请重新申请");
      return;
    }
    if (password.length < 8) {
      setError("新密码至少 8 个字符");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(kind, token, password);
      setDone(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "重置失败，请重试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          密码已重置，请使用新密码登录。
        </div>
        <Link
          href={loginHref}
          className="block text-center text-sm font-medium text-blue-600"
        >
          前往登录
        </Link>
      </div>
    );
  }

  if (token === null) {
    return (
      <p className="text-sm text-slate-500">正在校验重置链接…</p>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          htmlFor="new-password"
          className="text-sm font-medium text-slate-700"
        >
          新密码
        </label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 个字符"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          fullWidth
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="confirm-password"
          className="text-sm font-medium text-slate-700"
        >
          确认新密码
        </label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="再次输入新密码"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
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
        {submitting ? "提交中…" : "重置密码"}
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
