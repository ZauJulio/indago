// ─── Shared types for HyperJson client-side hooks ─────────────────────────────

/** Configuration for a single filter applied to a data array. */
export interface FilterConfig<T> {
  key: keyof T;
  value: string | undefined;
}

/** Direction for sorting. */
export type SortDir = "asc" | "desc";

/** Configuration for sorting a data array by a key and direction. */
export interface SortConfig<T> {
  key: keyof T;
  dir: SortDir;
}

/** Result returned by the `usePaginate` hook. */
export interface PaginationResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

/** Composed result chaining filter → search → sort → paginate. */
export interface ComposedQuery<T> {
  filtered: T[];
  searched: T[];
  sorted: T[];
  paginated: PaginationResult<T>;
}
