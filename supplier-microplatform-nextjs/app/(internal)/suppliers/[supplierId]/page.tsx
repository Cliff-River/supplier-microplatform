import { Suspense } from "react";
import { SupplierDetailClient } from "./client";

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ supplierId }) => (
        <SupplierDetailClient supplierId={supplierId} />
      ))}
    </Suspense>
  );
}
