import { useMemo } from "react";

import type { FilterConfig } from "./types.ts";

/**
 * Filters an array by multiple filter configurations.
 * Skips filters whose value is `undefined` or `"All"`.
 * Supports string equality and array inclusion checks.
 */
export function useFilter<T>(data: T[], filters: FilterConfig<T>[]): T[] {
  return useMemo(() => {
    const active = filters.filter((f) => f.value && f.value !== "All");
    if (active.length === 0) return data;

    return data.filter((item) =>
      active.every(({ key, value }) => {
        const itemVal = item[key];

        if (typeof itemVal === "string") return itemVal === value;
        if (Array.isArray(itemVal)) return itemVal.includes(value);

        return false;
      }),
    );
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [data, JSON.stringify(filters)]);
}
