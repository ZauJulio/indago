import type { ContentMeta } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  Public types for ContentRepository
// ─────────────────────────────────────────────────────────────────────────────

/** Column filters applied as exact-match SQL predicates (or JSON array search for `"tag"`). */
export type SearchFilters = Record<string, string | undefined>;

/** Sort configuration for search results. */
export interface SortConfig<T> {
  sortBy: [keyof T] extends [string] ? keyof T : never;
  sortDir: "asc" | "desc";
}

/** Pagination configuration for search results. */
export interface PaginationConfig {
  /** 1-based page number. */
  page: number;
  /** Items per page. */
  pageSize: number;
}

/** Parameters accepted by `ContentRepository.search`. */
export interface ContentSearchParams<T> {
  /**
   * Canonical DB locale to scope the query to (e.g. `"en"`, `"pt-BR"`).
   * When omitted, the search spans **every** locale.
   */
  locale?: string;
  /** Free-text query matched against the FTS5 index (prefix matching). */
  searchQuery?: string;
  /** Exact-match column filters; `"tag"` is treated as a JSON-array contains. */
  filters?: SearchFilters;
  sort?: SortConfig<T>;
  pagination?: PaginationConfig;
}

/** Serializable search payload returned to a route loader. */
export interface SearchResult<T extends ContentMeta> {
  /** Matched rows — metadata only. The MDX body is resolved in the view layer. */
  results: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/** Parameters accepted by `ContentRepository.related`. */
export interface RelatedParams<T> {
  /** Slug of the source item — always excluded from the results. */
  slug: string;
  /**
   * Candidate tags in **priority order** (`tags[0]` is the strongest signal).
   * A row's rank is the position of the highest-priority tag it shares, so
   * `tags[0]` matches fill the list first, then `tags[1]` complements up to
   * `limit`, and so on ("rank by tag order").
   */
  tags: string[];
  /**
   * Canonical DB locale to scope the query to (e.g. `"en"`, `"pt-BR"`).
   * When omitted, the lookup spans **every** locale.
   */
  locale?: string;
  /** Maximum rows to return. Defaults to `3`. */
  limit?: number;
  /** Array field the tags live in (bridge table). Defaults to `"tags"`. */
  field?: [keyof T] extends [string] ? keyof T : string;
}

/** Parameters accepted by `ContentRepository.searchSections` (composed index only). */
export interface SectionSearchParams {
  /** Free-text query matched against the per-section FTS5 index (prefix matching). */
  searchQuery: string;
  /** Canonical DB locale to scope hits to. When omitted, spans every locale. */
  locale?: string;
  /** Restrict to a single article's sections (the `#`-prefixed "this page" search). */
  slug?: string;
  /** Maximum hits to return. Defaults to `20`. */
  limit?: number;
}

/** One section-level search hit — enough to deep-link to the heading anchor. */
export interface SectionHit {
  /** Slug of the article the section belongs to. */
  slug: string;
  /** Anchor id of the heading (matches the rendered `id`). */
  headingId: string;
  /** Heading display title. */
  title: string;
  /** Heading depth (1–6). */
  level: number;
}

/** Options for `ContentRepository.distinctValues`. */
export interface DistinctValuesOptions<T> {
  /** Column to read distinct values from (e.g. `"tags"`, `"cuisine"`). */
  column: [keyof T] extends [string] ? keyof T : never;
  /** When the column holds a stringified JSON array, parse & flatten it. */
  isJson?: boolean;
  /** Sort by descending frequency instead of alphabetically. */
  sortByFrequency?: boolean;
}

/** Constructor options for `ContentRepository`. */
export interface ContentRepositoryOptions {
  /** Collection / table name (e.g. `"article"`, `"recipe"`). */
  contentName: string;
  /** FTS5 virtual table name. Defaults to `${contentName}_fts`. */
  ftsTable?: string;
  /**
   * `"composed"`-indexed collection: the body is tokenized only in the per-section
   * FTS (the page FTS is frontmatter-only), so `search()` reaches body text by
   * matching the section FTS and aggregating hits back to their slug. Default `false`.
   */
  composed?: boolean;
}
