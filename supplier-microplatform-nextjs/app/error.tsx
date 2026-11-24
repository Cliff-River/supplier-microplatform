"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-500">出错了</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">页面加载失败</h1>
        <p className="mt-2 break-all text-sm text-slate-500">
          {error.message || "请稍后重试"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          重新加载
        </button>
      </div>
    </main>
  );
}
