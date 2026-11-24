export interface PaginationQuery {
  page?: string | number;
  pageSize?: string | number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(
  query: PaginationQuery | undefined,
  defaultPageSize = 20,
  maxPageSize = 100,
): Pagination {
  const page = Math.max(1, Number(query?.page ?? 1) || 1);
  const rawSize = Number(query?.pageSize ?? defaultPageSize) || defaultPageSize;
  const pageSize = Math.min(Math.max(1, rawSize), maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta(
  total: number,
  pagination: Pagination,
): { page: number; pageSize: number; total: number } {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
  };
}
