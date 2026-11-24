import { Suspense } from "react";
import { InquiryDetailClient } from "./client";

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; inquiryId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ projectId, inquiryId }) => (
        <InquiryDetailClient projectId={projectId} inquiryId={inquiryId} />
      ))}
    </Suspense>
  );
}
