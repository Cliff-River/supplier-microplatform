import { Suspense } from "react";
import { EditProjectClient } from "./client";

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ projectId }) => (
        <EditProjectClient projectId={projectId} />
      ))}
    </Suspense>
  );
}
