import type { ReactNode } from "react";
import { InternalShell } from "@/components/layout/internal-shell";

// 内部端依赖登录态与当前路径，采用阻塞渲染；
// 动态路由页面内部使用 Suspense 包裹 useParams 等内容。
export const instant = false;

export default function InternalLayout({ children }: { children: ReactNode }) {
  return <InternalShell>{children}</InternalShell>;
}
