import type { SearchFilters } from "./repository-types.ts";
import type { ContentMeta } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  SQL & row helpers (pure) for ContentRepository
// ─────────────────────────────────────────────────────────────────────────────

/** Active filter entry with its column, operator and bound value. */
interface FilterEntry {
  column: string;
  /** `"tag"` for indexed array-membership (bridge table); `"eq"` for exact match.
   *  Free-text search is FTS5 `MATCH` (indexed) — never `LIKE`. */
  op: "tag" | "eq";
  value: string;
}

/** Returns the active filter entries (skips `undefined`, `""`, and `"All"` values). */
export function buildFilterEntries(filters: SearchFilters): FilterEntry[] {
  return Object.entries(filters)
    .filter((entry): entry is [string, string] => {
      const v = entry[1];
      return v !== undefined && v !== "" && v !== "All";
    })
    .map(([column, value]) => {
      if (column === "tag") {
        // Array membership resolved against the `<table>_tags` bridge: `column`
        // is the source field (`tags`), `value` the bare tag. See `search()`.
        return { column: "tags", op: "tag" as const, value };
      }

      return { column, op: "eq" as const, value };
    });
}

/** Sanitises and formats a search string for FTS5 prefix matching. */
export function buildFtsQuery(raw: string): string {
  return raw
    .trim()
    .replace(/"/g, '""')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word}"*`)
    .join(" AND ");
}

/**
 * Parses any string property that looks like a JSON array/object (starts with
 * `[` or `{`) back into its structured value. Returns a shallow copy.
 */
export function parseJsonFields<T extends Record<string, unknown>>(row: T): T {
  const result: Record<string, unknown> = { ...row };

  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        // Keep the original string if parsing fails.
      }
    }
  }

  return result as T;
}

/** Strips the internal pagination + content columns, returning parsed metadata. */
export function toMetaItem<T extends ContentMeta>(raw: Record<string, unknown>): T {
  const { _total_count: _count, content: _content, ...meta } = raw;
  return parseJsonFields(meta) as unknown as T;
}
