import { Suspense } from "react";
import { ProjectDetailClient } from "./client";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ projectId }) => (
        <ProjectDetailClient projectId={projectId} />
      ))}
    </Suspense>
  );
}
