import { useMemo } from "react";

/**
 * Performs a case-insensitive full-text search across the specified fields of each item.
 * Supports string values and arrays of strings.
 */
export function useSearch<T>(data: T[], query: string, fields: (keyof T)[]): T[] {
  return useMemo(() => {
    if (!query.trim()) return data;

    const lower = query.toLowerCase();

    return data.filter((item) =>
      fields.some((field) => {
        const val = item[field];

        if (typeof val === "string") return val.toLowerCase().includes(lower);
        if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(lower));

        return false;
      }),
    );
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, JSON.stringify(fields)]);
}
