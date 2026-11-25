import { Suspense } from "react";
import NewProjectClient from "./client";

export default function NewProjectPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      <NewProjectClient />
    </Suspense>
  );
}
