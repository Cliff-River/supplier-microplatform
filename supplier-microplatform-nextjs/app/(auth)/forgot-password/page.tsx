import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="找回密码"
      description="输入账号绑定邮箱，我们会发送重置密码链接。"
    >
      <ForgotPasswordForm kind="internal" />
    </AuthShell>
  );
}
