export const INTERNAL_AUTH = Symbol('INTERNAL_AUTH');
export const SUPPLIER_AUTH = Symbol('SUPPLIER_AUTH');

export type InternalAuth = ReturnType<
  typeof import('./auth.config.js').createInternalAuth
>;
export type SupplierAuth = ReturnType<
  typeof import('./auth.config.js').createSupplierAuth
>;
