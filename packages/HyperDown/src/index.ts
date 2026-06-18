// ─── HyperDown ───────────────────────────────────────────────
// Markdown-driven content engine with server-side SQLite (FTS5) search.
//
// Provides: frontmatter parsing, MDX rendering, an OOP `ContentRepository` that
// runs full-text search / facets / by-slug lookups in route loaders, and a
// browser-safe content resolver for rendering MDX bodies in views.

export type { ContentItem, ContentMeta, ContentModuleMap, MdxComponent } from "../src/db/types.ts";

// ── Server-side data access types (route loaders) ────────────────────────────
// The runtime values (`ContentRepository`, `hyperDownClient`) live in the
// server-only entry `@indago/hyper-down/server`; these are the (erased) types.
export type {
  ContentRepositoryOptions,
  ContentSearchParams,
  DistinctValuesOptions,
  PaginationConfig,
  SearchFilters,
  SearchResult,
  SortConfig,
} from "../src/db/repository.ts";

// ── View layer (browser-safe) ────────────────────────────────────────────────
export { createContentResolver } from "../src/hooks/index.ts";
export { MdxRender } from "../src/components/MdxRender.tsx";
export type { MdxRenderProps } from "../src/components/MdxRender.tsx";
export {
  MermaidBlock,
  defaultMdxComponents,
  createMdxComponents,
} from "../src/components/MdxComponents.tsx";
export type { ComponentMap } from "../src/components/MdxComponents.tsx";
export { Sidebar } from "../src/components/Sidebar.tsx";
export type { SidebarProps, TreeNode } from "../src/components/Sidebar.tsx";

// ── Sections (composed index / sidebars) ──────────────────────────────────────
// `parseSections` builds the same heading tree the writer stores on a composed
// collection's `sections` column — handy for client-side or non-composed use.
export { parseSections, extractSectionRecords } from "../src/frontmatter/sections.ts";
export type {
  IndexMode,
  SectionBadge,
  SectionNode,
  SectionRecord,
} from "../src/frontmatter/sections.ts";
export type { SectionHit, SectionSearchParams } from "../src/db/repository-types.ts";

// ── Frontmatter parser ───────────────────────────────────────────────────────
export { parseFrontmatter } from "../src/frontmatter/parser.ts";
export type { ParsedFrontmatter } from "../src/frontmatter/parser.ts";

// ── Config + i18n utils ──────────────────────────────────────────────────────
export type { HyperDownConfiguration } from "../src/utils/types.ts";
export { getLocale, getDisplayLocale, getFallbackLocale } from "../src/utils/i18n.ts";
