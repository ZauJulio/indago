import { useMemo } from "react";

import type { PaginationResult } from "./types.ts";

/**
 * Paginates an array, clamping the page within valid bounds.
 * Returns the slice of items for the current page along with pagination metadata.
 */
export function usePaginate<T>(data: T[], page: number, perPage: number): PaginationResult<T> {
  return useMemo(() => {
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    const start = (clampedPage - 1) * perPage;
    const items = data.slice(start, start + perPage);

    return { items, page: clampedPage, totalPages, total };
  }, [data, page, perPage]);
}
