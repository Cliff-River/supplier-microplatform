import type { ReactNode } from "react";
import { SupplierShell } from "@/components/layout/supplier-shell";

// 供应商端依赖登录态与当前路径，采用阻塞渲染；
// 动态路由页面内部使用 Suspense 包裹。
export const instant = false;

export default function SupplierPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SupplierShell>{children}</SupplierShell>;
}
