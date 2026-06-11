import { useMemo } from "react";

import type { SortConfig } from "./types.ts";

/**
 * Sorts an array by a key and direction.
 * - `null` sort config returns the data unchanged.
 * - Strings are compared with `localeCompare`; other types are coerced to numbers.
 * - `null` / `undefined` values are sorted to the end.
 */
export function useSort<T>(data: T[], sort: SortConfig<T> | null): T[] {
  return useMemo(() => {
    if (!sort) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const cmp =
        typeof aVal === "string" && typeof bVal === "string"
          ? aVal.localeCompare(bVal)
          : Number(aVal) - Number(bVal);

      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);
}
