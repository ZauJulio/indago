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

/** Input for {@link buildRelatedQuery}. */
interface RelatedQueryInput {
  /** Collection / table name (e.g. `"article"`). */
  table: string;
  /** Source slug to exclude from the results. */
  slug: string;
  /** Candidate tags in priority order (`tags[0]` strongest). Must be non-empty. */
  tags: string[];
  /** Bridge-table field the tags live in (usually `"tags"`). */
  field: string;
  /** Locale to scope to; omit to span every locale. */
  locale?: string;
  /** Maximum rows to return. */
  limit: number;
}

/**
 * Builds the SQL + bound params for `ContentRepository.related`. A row's rank is
 * the position of the **highest-priority** tag it shares — `MIN` over the matched
 * tag positions — so `tags[0]` matches sort first, then `tags[1]` fills the rest,
 * and so on. Ties break by most-recent `date`. The source `slug` is excluded.
 *
 * Membership is resolved against the indexed `<table>_tags` bridge (sargable), so
 * the candidate set never full-scans the collection.
 */
export function buildRelatedQuery(input: RelatedQueryInput): {
  sql: string;
  bind: (string | number)[];
} {
  const { table, slug, tags, field, locale, limit } = input;

  // `CASE t.value WHEN ?tag0 THEN 0 …` maps each tag to its priority index. The
  // `IN (…)` in WHERE restricts joined rows to these tags, so the CASE — and thus
  // MIN — never sees a NULL branch.
  const rankCases = tags.map((_, i) => `WHEN ? THEN ${i}`).join(" ");
  const placeholders = tags.map(() => "?").join(", ");

  const where = [`t.field = ?`, `t.value IN (${placeholders})`, `c.slug != ?`];
  const bind: (string | number)[] = [...tags, field, ...tags, slug];

  if (locale) {
    where.push(`c.locale = ?`);
    bind.push(locale);
  }

  // `?` order follows the SQL text: CASE tags (SELECT) → field, IN tags, slug,
  // [locale] (WHERE) → limit. GROUP BY the PK makes `c.*` deterministic per group.
  const sql =
    `SELECT c.*, MIN(CASE t.value ${rankCases} END) AS _rank ` +
    `FROM ${table} c JOIN ${table}_tags t ON t.content_id = c.id ` +
    `WHERE ${where.join(" AND ")} ` +
    `GROUP BY c.id ORDER BY _rank ASC, c.date DESC LIMIT ?`;
  bind.push(limit);

  return { sql, bind };
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

/** Strips the internal pagination/ranking + content columns, returning parsed metadata. */
export function toMetaItem<T extends ContentMeta>(raw: Record<string, unknown>): T {
  const { _total_count: _count, _rank: _r, content: _content, ...meta } = raw;
  return parseJsonFields(meta) as unknown as T;
}
