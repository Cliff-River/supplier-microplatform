import type { ReactNode } from "react";
import { SupplierShell } from "@/components/layout/supplier-shell";

// 布局只提供静态外壳，登录态加载不阻塞子页面渲染。
export default function SupplierPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SupplierShell>{children}</SupplierShell>;
}
