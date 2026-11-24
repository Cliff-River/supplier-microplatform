export type AuthKind = "internal" | "supplier";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role?: "ADMIN" | "MEMBER";
  supplierId?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export interface Session {
  user: SessionUser;
  session?: { id: string; expiresAt: string };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function parseError(response: Response): Promise<AuthError> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    };
    const message =
      payload.message ?? payload.error?.message ?? `请求失败（${response.status}）`;
    return new AuthError(message, payload.code ?? payload.error?.code);
  } catch {
    return new AuthError(text || `请求失败（${response.status}）`);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function getSession(kind: AuthKind): Promise<Session | null> {
  return fetch(`/api/auth/${kind}/get-session`, {
    credentials: "include",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const text = await response.text();
      if (!text) return null;
      const data = JSON.parse(text) as Session | null;
      return data?.user ? data : null;
    })
    .catch(() => null);
}

export function signIn(
  kind: AuthKind,
  username: string,
  password: string,
): Promise<unknown> {
  return post(`/api/auth/${kind}/sign-in/username`, { username, password });
}

export function signOut(kind: AuthKind): Promise<unknown> {
  return post(`/api/auth/${kind}/sign-out`, {});
}

export function requestPasswordReset(
  kind: AuthKind,
  email: string,
  redirectTo: string,
): Promise<unknown> {
  return post(`/api/auth/${kind}/request-password-reset`, {
    email,
    redirectTo,
  });
}

export function resetPassword(
  kind: AuthKind,
  token: string,
  newPassword: string,
): Promise<unknown> {
  return post(`/api/auth/${kind}/reset-password`, { token, newPassword });
}

export function changePassword(
  kind: AuthKind,
  currentPassword: string,
  newPassword: string,
): Promise<unknown> {
  return post(`/api/auth/${kind}/change-password`, {
    currentPassword,
    newPassword,
    revokeOtherSessions: false,
  });
}

export function loginPath(kind: AuthKind): string {
  return kind === "internal" ? "/login" : "/supplier/login";
}

export function changePasswordPath(kind: AuthKind): string {
  return kind === "internal" ? "/change-password" : "/supplier/change-password";
}
