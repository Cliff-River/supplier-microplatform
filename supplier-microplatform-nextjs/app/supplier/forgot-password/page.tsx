import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function SupplierForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Supplier Recovery"
      title="找回密码"
      description="输入供应商账号绑定邮箱，我们会发送重置密码链接。"
    >
      <ForgotPasswordForm kind="supplier" />
    </AuthShell>
  );
}
