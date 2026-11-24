import { Suspense } from "react";
import { SupplierInquiryDetailClient } from "./client";

export default function SupplierInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ inquiryId }) => (
        <SupplierInquiryDetailClient inquiryId={inquiryId} />
      ))}
    </Suspense>
  );
}
