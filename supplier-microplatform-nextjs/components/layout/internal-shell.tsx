"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSession, signOut } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "工作台", icon: "dashboard" },
  { href: "/projects", label: "项目与询价", icon: "projects" },
  { href: "/suppliers", label: "供应商", icon: "suppliers" },
  { href: "/admin/users", label: "内部用户", icon: "users", adminOnly: true },
  { href: "/admin/mail-logs", label: "邮件日志", icon: "inbox", adminOnly: true },
  { href: "/admin/settings", label: "系统设置", icon: "settings", adminOnly: true },
];

export function InternalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["internal-session"],
    queryFn: () => getSession("internal"),
  });

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.user.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [isLoading, router, session]);

  useEffect(() => {
    // 路由变化时关闭移动端菜单与用户菜单，属于与浏览历史同步的必要副作用。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (isLoading || !session?.user) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          正在加载…
        </div>
      </div>
    );
  }

  const user = session.user;
  const isAdmin = user.role === "ADMIN";
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);
  const current = visibleNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  async function handleLogout() {
    await signOut("internal");
    queryClient.clear();
    router.replace("/login");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
          SM
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">供应商微平台</p>
          <p className="text-[11px] text-slate-500">内部工作台</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link
          href="/account"
          className="block rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          我的账号
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="打开菜单"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                {current?.label ?? "工作台"}
              </h1>
              <p className="text-xs text-slate-500">
                {isAdmin ? "管理员" : "内部员工"} · {user.name}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-3 pl-1.5 text-sm text-slate-700 hover:border-slate-300"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {user.name.slice(0, 1)}
              </span>
              <span className="hidden sm:inline">{user.username}</span>
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <Link
                  href="/account"
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  我的账号
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
