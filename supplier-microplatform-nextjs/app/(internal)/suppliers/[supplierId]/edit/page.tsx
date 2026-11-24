import { Suspense } from "react";
import { EditSupplierClient } from "./client";

export default function EditSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中…</p>}>
      {params.then(({ supplierId }) => (
        <EditSupplierClient supplierId={supplierId} />
      ))}
    </Suspense>
  );
}
