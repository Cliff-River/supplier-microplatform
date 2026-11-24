import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-medium tracking-widest text-slate-400 uppercase">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          页面不存在
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          您访问的内容不存在或已被移除。
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            进入工作台
          </Link>
          <Link
            href="/supplier/dashboard"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            供应商工作台
          </Link>
        </div>
      </div>
    </div>
  );
}
