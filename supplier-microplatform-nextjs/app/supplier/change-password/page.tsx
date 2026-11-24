import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function SupplierChangePasswordPage() {
  return (
    <AuthShell
      eyebrow="Supplier Security"
      title="修改密码"
      description="首次登录需要修改初始密码，修改成功后才能继续使用平台。"
    >
      <ChangePasswordForm kind="supplier" />
    </AuthShell>
  );
}
