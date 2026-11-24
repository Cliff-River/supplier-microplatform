import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-600">403</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">没有访问权限</h1>
        <p className="mt-2 text-sm text-slate-500">
          当前账号无权访问该页面，如需开通请联系管理员。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            返回工作台
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            切换账号
          </Link>
        </div>
      </div>
    </main>
  );
}
