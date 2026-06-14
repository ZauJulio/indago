import { getFallbackLocale, getLocale } from "../utils/i18n.ts";
import { contentLog } from "../utils/logger.server.ts";
import { hyperDownClient } from "./client/index.ts";
import {
  buildFilterEntries,
  buildFtsQuery,
  buildRelatedQuery,
  parseJsonFields,
  toMetaItem,
} from "./repository-sql.ts";

import type { SQLiteBindValue } from "./client/types.ts";
import type {
  ContentRepositoryOptions,
  ContentSearchParams,
  DistinctValuesOptions,
  RelatedParams,
  SearchResult,
} from "./repository-types.ts";
import type { ContentMeta, ContentRow, DistinctValueRow } from "./types.ts";

// Re-export public types for `@indago/hyper-down/server` and the main barrel.
export type {
  ContentRepositoryOptions,
  ContentSearchParams,
  DistinctValuesOptions,
  PaginationConfig,
  RelatedParams,
  SearchFilters,
  SearchResult,
  SortConfig,
} from "./repository-types.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-side DAO for one HyperDown collection. All methods run on the server
 * (Vike `+data` loaders) against the generated `.db` via {@link hyperDownClient};
 * never opened in the browser. Results are JSON-serializable.
 *
 * @typeParam T - Collection metadata shape (e.g. `ArticleMeta`).
 */
export class ContentRepository<T extends ContentMeta = ContentMeta> {
  readonly contentName: string;
  readonly ftsTable: string;

  /** @param options - Collection name and optional FTS5 table (default `${contentName}_fts`). */
  constructor(options: ContentRepositoryOptions) {
    this.contentName = options.contentName;
    this.ftsTable = options.ftsTable ?? `${options.contentName}_fts`;
  }

  /**
   * Paginated, filtered full-text search. `params.locale` scopes only the
   * returned rows (omit for all locales); `searchQuery` matches across all
   * locales, so "slow"/"lenta" both surface the same slug in the active locale.
   */
  async search(params: ContentSearchParams<T>): Promise<SearchResult<T>> {
    const { locale, searchQuery = "", filters = {}, sort, pagination } = params;
    const table = this.contentName;

    // Shared WHERE + binds; rows and count queries reuse it for one result set.
    const where: string[] = ["1 = 1"];
    const whereBind: SQLiteBindValue[] = [];

    if (locale) {
      where.push("locale = ?");
      whereBind.push(locale);
    }

    // Filters are exact-match or tag-bridge only; free-text goes through FTS5
    // MATCH below (indexed) — never LIKE, which would full-scan the table.
    for (const { column, op, value } of buildFilterEntries(filters)) {
      if (op === "tag") {
        // Sargable array-membership via the `(field, value)`-indexed `<table>_tags` bridge.
        where.push(`id IN (SELECT content_id FROM ${table}_tags WHERE field = ? AND value = ?)`);
        whereBind.push(column, value);
      } else {
        where.push(`${column} = ?`);
        whereBind.push(value);
      }
    }

    if (searchQuery.trim()) {
      // FTS matches across all locales, mapped back to slugs; the outer `locale`
      // filter then yields one selected-locale row per slug. (FTS rowid === row id.)
      where.push(
        `slug IN (SELECT slug FROM ${table}
          WHERE id IN (
            SELECT rowid FROM ${this.ftsTable}
            WHERE ${this.ftsTable} MATCH ?
          )
        )`,
      );

      whereBind.push(buildFtsQuery(searchQuery));
    }

    const whereSql = where.join(" AND ");

    // No `COUNT(*) OVER()`: an uncorrelated scalar subquery carries the unpaginated
    // total on each row (evaluated once) while the outer query keeps its index-ordered,
    // LIMIT-short-circuiting scan. `whereSql` appears twice, so its binds are doubled.
    const totalProjection = pagination
      ? `, (SELECT COUNT(*) FROM ${table} WHERE ${whereSql}) AS _total_count`
      : "";
    let rowsSql = `SELECT *${totalProjection} FROM ${table} WHERE ${whereSql}`;
    const rowsBind = pagination ? [...whereBind, ...whereBind] : [...whereBind];

    if (sort?.sortBy) {
      // Direction hard-clamped here; `sortBy` is interpolated (SQLite can't bind
      // identifiers), so callers must pass allow-listed column keys.
      const dir = sort.sortDir === "asc" ? "ASC" : "DESC";
      rowsSql += ` ORDER BY ${sort.sortBy} ${dir}`;
    }

    if (pagination) {
      const offset = (pagination.page - 1) * pagination.pageSize;
      rowsSql += " LIMIT ? OFFSET ?";
      rowsBind.push(pagination.pageSize, offset);
    }

    const rows = await hyperDownClient.query<ContentRow<T>>(rowsSql, rowsBind, table);
    const results = rows.map((row) => toMetaItem<T>(row));

    // Total rides on the returned rows; an empty page (out-of-range `?page`)
    // carries none, so only that case needs a fallback COUNT(*).
    let totalCount: number;

    if (!pagination) {
      totalCount = results.length;
    } else if (rows.length > 0) {
      totalCount = Number(rows[0]._total_count ?? 0);
    } else {
      const countRows = await hyperDownClient.query<{ _total_count: number }>(
        `SELECT COUNT(*) AS _total_count FROM ${table} WHERE ${whereSql}`,
        whereBind,
        table,
      );

      totalCount = Number(countRows[0]?._total_count ?? 0);
    }

    const pageSize = pagination?.pageSize ?? results.length;
    const totalPages = pagination ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

    return {
      results,
      totalCount,
      totalPages,
      currentPage: pagination?.page ?? 1,
    };
  }

  /**
   * Up to `limit` other rows that share a tag with the source item, ranked **by
   * tag order**: a row's position is decided by the highest-priority tag it
   * shares, so `tags[0]` matches come first and lower-priority tags only fill
   * the remaining slots. Ties break by most-recent `date`; the source `slug` is
   * always excluded. Powers "you might also like" / suggested-content UIs.
   */
  async related(params: RelatedParams<T>): Promise<T[]> {
    const { slug, tags, locale, limit = 3, field = "tags" } = params;
    if (tags.length === 0 || limit <= 0) return [];

    const { sql, bind } = buildRelatedQuery({
      table: this.contentName,
      slug,
      tags,
      field: field as string,
      locale,
      limit,
    });

    const rows = await hyperDownClient.query<ContentRow<T>>(sql, bind, this.contentName);
    return rows.map((row) => toMetaItem<T>(row));
  }

  /**
   * Distinct values of a column for one locale — data source for facet filter UIs.
   * Ordered alphabetically or by frequency.
   */
  async distinctValues(options: DistinctValuesOptions<T>, locale: string): Promise<string[]> {
    const { column, isJson, sortByFrequency } = options;
    const col = column as string;
    const table = this.contentName;
    const order = sortByFrequency ? "freq DESC, value ASC" : "value ASC";

    // Array facets group on the indexed `<table>_tags` bridge (index-served GROUP BY,
    // no per-row JSON parse); scalar facets group on the column itself.
    const sql = isJson
      ? `SELECT t.value AS value, COUNT(*) AS freq
         FROM ${table}_tags t JOIN ${table} c ON c.id = t.content_id
         WHERE t.field = ? AND c.locale = ?
         GROUP BY t.value
         ORDER BY ${order}`
      : `SELECT ${col} AS value, COUNT(*) AS freq
         FROM ${table}
         WHERE locale = ? AND ${col} IS NOT NULL AND ${col} != ''
         GROUP BY ${col}
         ORDER BY ${order}`;

    try {
      const bind = isJson ? [col, locale] : [locale];
      const rows = await hyperDownClient.query<DistinctValueRow>(sql, bind, table);
      return rows.map((r) => r.value);
    } catch (err) {
      contentLog.error({ err, column: col }, "Failed to fetch distinct values");
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * Looks up one row's metadata by slug, preferring `locale` and falling back to
   * the alternate. JSON-serializable, so it survives the server→client boundary.
   */
  async getMetaBySlug(slug?: string, locale = "en"): Promise<T | undefined> {
    if (!slug) return undefined;

    const primary = getLocale({ language: locale });
    const { rows } = await this.queryBySlug(slug, primary, getFallbackLocale(primary));
    if (rows.length === 0) return undefined;

    return parseJsonFields(rows[0]) as unknown as T;
  }

  /**
   * Fetches a row by slug in a single query (`locale IN (?, ?)`, preferred picked
   * in JS), avoiding a second round-trip on a locale miss.
   */
  private async queryBySlug(
    slug: string,
    primaryLocale: string,
    fallbackLocale: string,
  ): Promise<{ rows: ContentRow<T>[]; usedLocale: string }> {
    const sql = `SELECT * FROM ${this.contentName} WHERE slug = ? AND locale IN (?, ?)`;

    const rows = await hyperDownClient.query<ContentRow<T>>(
      sql,
      [slug, primaryLocale, fallbackLocale],
      this.contentName,
    );

    if (rows.length === 0) return { rows, usedLocale: primaryLocale };

    const chosen = rows.find((row) => row.locale === primaryLocale) ?? rows[0];
    return { rows: [chosen], usedLocale: chosen.locale };
  }
}
