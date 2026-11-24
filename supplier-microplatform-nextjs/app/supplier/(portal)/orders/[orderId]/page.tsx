import { Suspense } from "react";
import { SupplierOrderDetailClient } from "./client";

export default function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ orderId }) => (
        <SupplierOrderDetailClient orderId={orderId} />
      ))}
    </Suspense>
  );
}
