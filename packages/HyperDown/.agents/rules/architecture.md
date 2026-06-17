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
3. **Composed index** (`database.index: "composed"`, or `indexByCollection.<type>`): adds a
   `<type>_sections` table + contentless `<type>_sections_fts`, and a `sections` JSON column
   (heading tree) on the main table. Headings are parsed by `frontmatter/sections.ts`
   (`parseSections`/`extractSectionRecords`); `#[label/#color]` heading badges are extracted
   into `SectionNode.badges` (and stripped from the body by the `remarkHeadingBadges` remark
   plugin so anchors stay clean). Default is `"page"` (no section tables).

## Runtime

- **Server loaders**: import the generated `<type>Repository` (never `new ContentRepository`
  directly). API: `search()` (FTS + filters + sort + pagination, cross-locale match → one
  row per slug in the requested locale), `distinctValues()` (facets), `getMetaBySlug()`
  (locale fallback, serializable; returns `meta.sections` tree on composed collections),
  `searchSections()` (composed only: per-section FTS hits → `{ slug, headingId, title, level }`;
  pass `slug` to scope to one article), `related()` (up to `limit` other items ranked by tag
  order — highest-priority shared tag wins, source slug excluded). `.db` opened read-only via `bun:sqlite`, or `node:sqlite`
  on Node ≥ 22 (e.g. Vercel). Server code is exported only from `@indago/hyper-down/server`.
- **Views**: `createContentResolver(contentModules[type])` → `getContent(slug, lang)`;
  render with `MdxRender`. No DB code on this path. Composed collections can render the
  heading tree with the default `<Sidebar/>` (`import "@indago/hyper-down/sidebar.css"`) or
  any custom component fed `meta.sections`.

## Plugins (`@indago/hyper-down/plugins`)

- `hyperdownMdxPlugin` — wraps `@mdx-js/rollup`, intercepts `*.mdx?raw`. **Must be
  registered before `vike()`/`react()`.**
- `hyperdownPlugin` — codegen + writer on `buildStart`; copies each `.db` into
  `dist/metadata/` on `closeBundle` (build only) so `dist` is self-contained.
- `hyperdownSitemapPlugin` — sitemap from `hyperdown.config.json#sitemap`.

## Exports

`.` (browser-safe: `MdxRender`, `createContentResolver`, `Sidebar`, `parseSections`,
`extractSectionRecords`, types) · `./server` (`ContentRepository`, `createLazyRepository`) ·
`./types` · `./plugins` (incl. `remarkHeadingBadges`) · `./next`
(`withHyperDown`, `runHyperDownNextCodegen`) · `./drizzle` (optional Drizzle proxy) ·
`./sidebar.css` (default `<Sidebar/>` styling).
