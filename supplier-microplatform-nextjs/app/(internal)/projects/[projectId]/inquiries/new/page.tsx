import { Suspense } from "react";
import { NewInquiryClient } from "./client";

export default function NewInquiryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ projectId }) => (
        <NewInquiryClient projectId={projectId} />
      ))}
    </Suspense>
  );
}
