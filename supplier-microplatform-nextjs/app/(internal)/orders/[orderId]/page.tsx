import { Suspense } from "react";
import { OrderDetailClient } from "./client";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ orderId }) => (
        <OrderDetailClient orderId={orderId} />
      ))}
    </Suspense>
  );
}
