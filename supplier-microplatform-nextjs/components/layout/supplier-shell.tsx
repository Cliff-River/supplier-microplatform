"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSession, signOut } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";

const navItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/supplier/dashboard", label: "工作台", icon: "dashboard" },
  { href: "/supplier/inquiries", label: "邀请询价", icon: "inbox" },
  { href: "/supplier/quote-history", label: "我的报价", icon: "file" },
  { href: "/supplier/orders", label: "我的订单", icon: "orders" },
  { href: "/supplier/account", label: "账号", icon: "users" },
];

/** 纯展示导航；pathname 为 null 时用于 Suspense 占位，不带高亮。 */
function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {navItems.map((item) => {
        const active =
          pathname !== null &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function PathAwareNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

function PathnameChangeListener({
  onPathnameChange,
}: {
  onPathnameChange: () => void;
}) {
  const pathname = usePathname();
  useEffect(() => {
    onPathnameChange();
  }, [pathname, onPathnameChange]);
  return null;
}

export function SupplierShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["supplier-session"],
    queryFn: () => getSession("supplier"),
  });

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/supplier/login");
      return;
    }
    if (session.user.mustChangePassword) {
      router.replace("/supplier/change-password");
    }
  }, [isLoading, router, session]);

  const handlePathnameChange = useCallback(() => {
    // 路由变化时关闭移动端菜单，属于与浏览历史同步的必要副作用。
    setMobileOpen(false);
  }, []);

  // 布局不阻塞渲染：登录态加载期间照常渲染子页面，
  // 页面自身展示加载态，避免整段导航被丢弃。
  const user = session?.user;

  async function handleLogout() {
    await signOut("supplier");
    queryClient.clear();
    router.replace("/supplier/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={null}>
        <PathnameChangeListener onPathnameChange={handlePathnameChange} />
      </Suspense>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
              SM
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">
                供应商微平台
              </p>
              <p className="text-[11px] text-slate-500">供应商协同</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            <Suspense fallback={<NavLinks pathname={null} />}>
              <PathAwareNav />
            </Suspense>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user?.name ?? (isLoading ? "正在加载…" : "")}
            </span>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                退出
              </button>
            ) : (
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
                aria-label={isLoading ? "正在加载" : "未登录"}
              />
            )}
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="菜单"
            >
              <Icon name={mobileOpen ? "close" : "menu"} className="h-5 w-5" />
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
            <Suspense fallback={<NavLinks pathname={null} />}>
              <PathAwareNav />
            </Suspense>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
