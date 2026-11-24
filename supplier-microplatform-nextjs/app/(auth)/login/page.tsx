import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Internal Access"
      title="内部账号登录"
      description="面向采购与业务人员。创建项目、邀请供应商、选标与履约管理都在这里完成。"
      footer={
        <p className="text-center text-xs text-slate-400">
          © 供应商微平台
        </p>
      }
    >
      <LoginForm kind="internal" />
    </AuthShell>
  );
}
