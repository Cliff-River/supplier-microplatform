"use client";

import { useRef, useState } from "react";
import { errorMessage, apiUpload } from "@/lib/api-client";
import { downloadAttachment } from "@/lib/download";
import { labelClass, smallButtonClass } from "@/components/ui/form";

export interface UploadedFile {
  id: string;
  fileName: string;
  size?: number;
}

export interface AttachmentRow {
  id: string;
  fileName: string;
  size?: number | null;
  createdAt?: string;
}

export function AttachmentField({
  files,
  onChange,
  label = "附件（可选）",
  accept,
}: {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  label?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of selected) {
        const result = await apiUpload<{ id: string; fileName: string; size: number }>(
          "/files",
          file,
        );
        uploaded.push({
          id: result.id,
          fileName: result.fileName,
          size: result.size,
        });
      }
      onChange([...files, ...uploaded]);
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={smallButtonClass}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "上传中…" : "选择文件"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleSelect}
        />
        <span className="text-xs text-slate-400">
          单个文件不超过 20MB，上传后自动关联
        </span>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              <span className="truncate text-slate-700">{file.fileName}</span>
              <button
                type="button"
                className="text-red-600 hover:underline"
                onClick={() => onChange(files.filter((row) => row.id !== file.id))}
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AttachmentList({
  attachments,
  emptyText = "暂无附件",
}: {
  attachments: AttachmentRow[];
  emptyText?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  if (attachments.length === 0) {
    return <p className="text-xs text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-1">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <ul className="space-y-1">
        {attachments.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            <span className="truncate text-slate-700">{file.fileName}</span>
            <button
              type="button"
              className="shrink-0 text-blue-600 hover:underline"
              onClick={() => {
                setError(null);
                downloadAttachment(file.id).catch((downloadError) =>
                  setError(errorMessage(downloadError)),
                );
              }}
            >
              下载
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
