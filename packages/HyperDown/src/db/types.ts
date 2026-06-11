import type { ComponentType } from "react";

// ─── Base Types ──────────────────────────────────────────────

/** Common metadata for any markdown content. Stripped down to basics. */
export interface ContentMeta {
  id: number;
  slug: string;
  locale: string;
}

/** A compiled MDX React component — accepts an optional `components` prop for element overrides. */
export type MdxComponent = ComponentType<{ components?: Record<string, ComponentType | string> }>;

/**
 * One `import.meta.glob()` entry: a lazy dynamic-import loader (browser, code-split)
 * or an eager module namespace (server/prerender, inlines the body into static HTML).
 * The generated `modules.ts` picks eager vs lazy via `import.meta.env.SSR`.
 */
export type ContentModule = (() => Promise<{ default: MdxComponent }>) | { default: MdxComponent };

/**
 * Map of file paths to {@link ContentModule} entries, resolved by suffix-matching
 * on language + slug. Pass a **static** `import.meta.glob()` (Vite can't resolve
 * dynamic glob literals) — usually one `contentModules[<name>]` of `@hyper-down/default`.
 */
export type ContentModuleMap = Record<string, ContentModule>;

/** A parsed MDX file: metadata + compiled React component. `null` when the MDX module cannot be resolved. */
export type ContentItem<T extends ContentMeta = ContentMeta> = T & {
  content: MdxComponent | null;
};

// ─── Raw SQLite Row Shapes ───────────────────────────────────

/** How SQLite returns a metadata field: structured values come back as serialized JSON strings. */
export type SqlColumn<V> = V extends string | number | boolean | null ? V : string;

/**
 * A raw `.db` row. Structured columns are still JSON strings here (`parseJsonFields`
 * re-parses them); the internal projection columns below are stripped by `toMetaItem`.
 */
export type ContentRow<T extends ContentMeta = ContentMeta> = {
  [K in keyof T]: SqlColumn<T[K]>;
} & {
  /** Raw MD/MDX body column kept in storage but excluded from returned metadata. */
  content?: string;
  /** Unpaginated total carried on each row by the count scalar subquery. */
  _total_count?: number;
};

/** A `(value, freq)` aggregate row produced by `ContentRepository.distinctValues`. */
export interface DistinctValueRow {
  value: string;
  freq: number;
}
