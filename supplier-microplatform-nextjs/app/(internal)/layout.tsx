import type { ReactNode } from "react";
import { InternalShell } from "@/components/layout/internal-shell";

// 布局只提供静态外壳，登录态加载不阻塞子页面渲染。
export default function InternalLayout({ children }: { children: ReactNode }) {
  return <InternalShell>{children}</InternalShell>;
}
