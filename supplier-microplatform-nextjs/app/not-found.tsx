import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-400">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">页面不存在</h1>
        <p className="mt-2 text-sm text-slate-500">
          您访问的页面可能已被移动或删除。
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          返回工作台
        </Link>
      </div>
    </main>
  );
}
