"use client";

import { Button, Input } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  changePasswordPath,
  getSession,
  signIn,
  type AuthKind,
} from "@/lib/auth";

interface LoginFormProps {
  kind: AuthKind;
}

export function LoginForm({ kind }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSupplier = kind === "supplier";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(kind, username.trim(), password);
      const session = await getSession(kind);
      if (!session) {
        throw new Error("登录状态未生效，请重试");
      }
      if (session.user.mustChangePassword) {
        router.replace(changePasswordPath(kind));
      } else {
        router.replace(isSupplier ? "/supplier/dashboard" : "/dashboard");
      }
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "登录失败，请重试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          htmlFor="username"
          className="text-sm font-medium text-slate-700"
        >
          用户名或邮箱
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          placeholder={isSupplier ? "请输入供应商账号" : "请输入内部账号"}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          fullWidth
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-700"
          >
            密码
          </label>
          <Link
            href={isSupplier ? "/supplier/forgot-password" : "/forgot-password"}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            忘记密码？
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="请输入密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        {submitting ? "登录中…" : "登录"}
      </Button>

      <p className="text-center text-xs text-slate-500">
        {isSupplier ? (
          <>
            内部员工请前往{" "}
            <Link href="/login" className="font-medium text-blue-600">
              内部登录
            </Link>
          </>
        ) : (
          <>
            供应商请前往{" "}
            <Link href="/supplier/login" className="font-medium text-blue-600">
              供应商登录
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
