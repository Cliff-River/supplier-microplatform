import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function SupplierLoginPage() {
  return (
    <AuthShell
      eyebrow="Supplier Portal"
      title="供应商登录"
      description="查看采购方邀请的询价、提交报价，并跟踪合同、验收与发票进度。"
      footer={
        <p className="text-center text-xs text-slate-400">
          © 供应商微平台
        </p>
      }
    >
      <LoginForm kind="supplier" />
    </AuthShell>
  );
}
