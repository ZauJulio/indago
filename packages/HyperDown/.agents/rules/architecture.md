# HyperDown — Architecture (invariants)

Markdown/MDX → SQLite (FTS5 contentless) → server-side loaders. **SSR-only**: the DB is
queried only on the server; there is no client-side database.

## Pipeline

1. **Codegen** (Vite plugin `buildStart`, `hyperdown gen:db`, or the Next adapter) writes
   into the consuming app, idempotently:
   - `.hyper-down/<contentDir>/<type>/types.ts` — ambient `<Type>Meta` interface.
   - `.hyper-down/<contentDir>/<type>/builder.ts` — lazy `<type>Repository` Proxy
     (deferred `new` — load-bearing for Rolldown chunk init order; keep it lazy).
   - `.hyper-down/<contentDir>/<type>/modules.ts` — **static** `import.meta.glob` of MDX
     bodies, `eager: true` (load-bearing for SSG body inlining).
   - `.hyper-down/default.ts` — `contentModules` map keyed by type.
2. **Writer** (`HyperDownWriter` → `CollectionDbBuilder` → `CollectionSchema`) emits one
   `.db` per type: metadata table + contentless FTS5 (`content=""`). The MD/MDX **body is
   tokenized into FTS but never stored** in SQLite.

## Runtime

- **Server loaders**: import the generated `<type>Repository` (never `new ContentRepository`
  directly). API: `search()` (FTS + filters + sort + pagination, cross-locale match → one
  row per slug in the requested locale), `distinctValues()` (facets), `getMetaBySlug()`
  (locale fallback, serializable). `.db` opened read-only via `bun:sqlite`, or `node:sqlite`
  on Node ≥ 22 (e.g. Vercel). Server code is exported only from `@virtus/hyper-down/server`.
- **Views**: `createContentResolver(contentModules[type])` → `getContent(slug, lang)`;
  render with `MdxRender`. No DB code on this path.

## Plugins (`@virtus/hyper-down/plugins`)

- `hyperdownMdxPlugin` — wraps `@mdx-js/rollup`, intercepts `*.mdx?raw`. **Must be
  registered before `vike()`/`react()`.**
- `hyperdownPlugin` — codegen + writer on `buildStart`; copies each `.db` into
  `dist/metadata/` on `closeBundle` (build only) so `dist` is self-contained.
- `hyperdownSitemapPlugin` — sitemap from `hyperdown.config.json#sitemap`.

## Exports

`.` (browser-safe: `MdxRender`, `createContentResolver`, types) · `./server`
(`ContentRepository`, `createLazyRepository`) · `./types` · `./plugins` · `./next`
(`withHyperDown`, `runHyperDownNextCodegen`) · `./drizzle` (optional Drizzle proxy).
