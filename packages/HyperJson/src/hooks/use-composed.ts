import { useFilter } from "./use-filter.ts";
import { usePaginate } from "./use-paginate.ts";
import { useSearch } from "./use-search.ts";
import { useSort } from "./use-sort.ts";

import type { ComposedQuery, FilterConfig, SortConfig } from "./types.ts";

/** Options for `useComposed`. */
interface UseComposedOptions<T> {
  filters?: FilterConfig<T>[];
  searchQuery?: string;
  searchFields?: (keyof T)[];
  sort?: SortConfig<T> | null;
  page?: number;
  perPage?: number;
}

/**
 * Chains filter → search → sort → paginate into a single composable hook.
 * Returns all intermediate results so consumers can access them independently.
 */
export function useComposed<T>(
  data: T[],
  {
    filters = [],
    searchQuery = "",
    searchFields = [],
    sort = null,
    page = 1,
    perPage = 10,
  }: UseComposedOptions<T> = {},
): ComposedQuery<T> {
  const filtered = useFilter(data, filters);
  const searched = useSearch(filtered, searchQuery, searchFields);
  const sorted = useSort(searched, sort);
  const paginated = usePaginate(sorted, page, perPage);

  return { filtered, searched, sorted, paginated };
}
