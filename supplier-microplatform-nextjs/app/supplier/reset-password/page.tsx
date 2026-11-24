import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function SupplierResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Supplier Reset"
      title="设置新密码"
      description="请设置至少 8 个字符的新密码，重置后使用新密码登录。"
    >
      <ResetPasswordForm kind="supplier" />
    </AuthShell>
  );
}
