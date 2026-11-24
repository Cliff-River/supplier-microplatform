import { apiFetch } from "@/lib/api-client";

/** 通过短期签名 URL 下载附件 */
export async function downloadAttachment(id: string): Promise<void> {
  const result = await apiFetch<{ url: string }>(`/files/${id}/access-token`, {
    method: "POST",
  });
  const link = document.createElement("a");
  link.href = result.url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
