export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: Record<string, unknown>;
}

export interface ListResult<T> {
  items: T[];
  meta: Record<string, unknown>;
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init),
  });

  const text = await response.text();
  let payload: Envelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? `请求失败（${response.status}）`,
      response.status,
      payload?.error?.details,
    );
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    const result = payload as Envelope<T> & { meta?: Record<string, unknown> };
    if (result.meta) {
      return { items: result.data as T[], meta: result.meta } as T;
    }
    return result.data as T;
  }

  return payload as T;
}

export function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<T>(path, { method: "POST", body: formData });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}
