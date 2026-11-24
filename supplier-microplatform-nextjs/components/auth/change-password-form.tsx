"use client";

import { Button, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  changePassword,
  getSession,
  loginPath,
  type AuthKind,
} from "@/lib/auth";

export function ChangePasswordForm({ kind }: { kind: AuthKind }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSession(kind).then((session) => {
      if (!mounted) return;
      if (!session) {
        router.replace(loginPath(kind));
        return;
      }
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [kind, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("新密码至少 8 个字符");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(kind, currentPassword, password);
      router.replace(kind === "internal" ? "/dashboard" : "/supplier/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "修改失败，请重试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-slate-500">正在加载…</p>;
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          htmlFor="current-password"
          className="text-sm font-medium text-slate-700"
        >
          当前密码
        </label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          placeholder="首次登录请输入邮件中的初始密码"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          fullWidth
        />
      </div>
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
        {submitting ? "保存中…" : "修改密码"}
      </Button>
      <p className="text-center text-xs text-slate-500">
        修改成功前无法访问其他功能。
      </p>
    </form>
  );
}
