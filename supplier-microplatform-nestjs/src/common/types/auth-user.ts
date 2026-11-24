export interface InternalAuthUser {
  kind: 'INTERNAL';
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'MEMBER';
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface SupplierAuthUser {
  kind: 'SUPPLIER';
  id: string;
  name: string;
  email: string;
  username: string;
  supplierId: string;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
}

export type AuthUser = InternalAuthUser | SupplierAuthUser;

export interface AuthenticatedRequest {
  authUser?: AuthUser;
  requestId?: string;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  ip?: string;
}
