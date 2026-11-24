import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 20% 15%, rgba(47,91,234,0.45), transparent 45%), radial-gradient(circle at 85% 75%, rgba(14,165,233,0.28), transparent 42%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sm font-semibold tracking-wide">
              SM
            </span>
            <span className="text-base font-semibold tracking-wide">
              供应商微平台
            </span>
          </div>
          <h1 className="mt-16 max-w-md text-3xl leading-snug font-semibold">
            让询价、报价与履约协作
            <span className="text-sky-300"> 全程留痕</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            统一管理供应商档案、询价与报价对比、订单合同、验收与发票材料，
            内部团队与供应商在同一平台上高效协同。
          </p>
          <ul className="mt-10 space-y-3 text-sm text-slate-300">
            {[
              "询价开放、报价截止与历史版本自动记录",
              "报价对比、差异高亮与 Excel 导出",
              "合同、验收单、发票附件分级权限与签名下载",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          内部账号与供应商账号相互隔离，请使用对应入口登录。
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-xs text-white">
                SM
              </span>
              供应商微平台
            </div>
          </div>
          <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
