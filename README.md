# Virtus — Local Headless CMS Toolkit

<p align="center">
  <img src="./packages/HyperDown/assets/logo.svg" alt="Virtus — Honos et Virtus" width="130" height="130" />
</p>

<p align="center">
  <a href="https://github.com/ZauJulio/virtus/actions/workflows/release.yml"><img alt="Release" src="https://github.com/ZauJulio/virtus/actions/workflows/release.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@virtus/hyper-down"><img alt="hyper-down" src="https://img.shields.io/npm/v/%40virtus%2Fhyper-down?label=%40virtus%2Fhyper-down" /></a>
  <a href="https://www.npmjs.com/package/@virtus/hyper-json"><img alt="hyper-json" src="https://img.shields.io/npm/v/%40virtus%2Fhyper-json?label=%40virtus%2Fhyper-json" /></a>
  <a href="https://www.npmjs.com/package/create-virtus-app"><img alt="create-virtus-app" src="https://img.shields.io/npm/v/create-virtus-app?label=create-virtus-app" /></a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-1-000000?logo=bun&logoColor=white" />
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white" />
  <img alt="SQLite FTS5" src="https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
</p>

Two **zero-backend** content engines plus a scaffolder. They turn a folder of content files
into a typed, searchable content layer that ships as static assets — no database service,
no API, no CMS server. Each engine exposes a **Vite plugin**, a **CLI**, and an **MCP
server** (so AI agents can drive it as tools), and bundles its JSON Schemas alongside the
dist for runtime validation.

| Package                                      | npm                                                                      | What it is                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [`packages/HyperDown`](./packages/HyperDown) | [`@virtus/hyper-down`](https://www.npmjs.com/package/@virtus/hyper-down) | Markdown/MDX → SQLite (FTS5 contentless) → server-side loaders. SSR-only, queried with `bun:sqlite` / `node:sqlite`. |
| [`packages/HyperJson`](./packages/HyperJson) | [`@virtus/hyper-json`](https://www.npmjs.com/package/@virtus/hyper-json) | JSON Schema → strict validation + generated TypeScript types + ambient module declarations for typed JSON imports.   |
| [`packages/scaffold`](./packages/scaffold)   | [`create-virtus-app`](https://www.npmjs.com/package/create-virtus-app)   | Scaffolder CLI — 4 templates (Vike, React Router v7, TanStack Start, Next.js), same routes + e2e suite in each.      |
| [`packages/configs`](./packages/configs)     | —                                                                        | Shared internal tooling config (tsconfig base, oxlint/oxfmt, Tailwind, Vite presets).                                |

> **The two engines are independent** — neither depends on the other. HyperDown owns
> Markdown/front-matter; HyperJson owns structured JSON. The reference consumer is the
> [portifolio](https://github.com/ZauJulio/portifolio) app, live at
> [zaujulio.vercel.app](https://zaujulio.vercel.app).

---

## Architecture

### The big picture

```text
content files                build time                          runtime
─────────────                ──────────                          ───────
content/<type>/<lang>/*.mdx  ──HyperDown──▶  per-type SQLite (.db)        ──▶  bun:sqlite / node:sqlite
              (front-matter)  contentless FTS5 index                           in server route loaders (SSR)
                              + .hyper-down/ codegen (builder/modules)         + lazy MDX via @hyper-down map

content/<type>/*.json        ──HyperJson──▶  Ajv validation                    typed @content/**.json imports
              (schema.json)   generated TS types + ambient d.ts                + headless filter/sort/search hooks
```

### HyperDown — Markdown/MDX engine

**Build time** (Vite plugin `hyperdownPlugin` on `buildStart`, `hyperdown gen:db`, or the
Next.js adapter):

1. **Codegen** (`HyperDownCodegen`) writes idempotently into the consuming app's
   `.hyper-down/` tree: an ambient `<Type>Meta` interface, a **lazy `<type>Repository`
   proxy** (server-only DAO), and a **static eager `import.meta.glob`** map of MDX bodies,
   re-exported as `contentModules` from `.hyper-down/default.ts`.
2. **Writer** (`HyperDownWriter` → `CollectionDbBuilder` → `CollectionSchema`) parses each
   file's front-matter (parallel read/parse/validate pool, then a serial single-transaction
   persist) and emits one `.db` per content type: a metadata table, an indexed
   `<type>_tags` bridge for array facets, and a **contentless FTS5** table (`content=""`).
   The FTS index covers the front-matter columns **plus the body text** — tokenized into
   the inverted index but **never stored**.
3. On `closeBundle` (build only) every `.db` is copied into `dist/metadata/` so the built
   output is self-contained.

**Runtime** — strictly split in two:

- **Server (route loaders)**: `ContentRepository<T>` — `search()` (FTS5 `MATCH` across all
  locales mapped back to one row per slug, filters, sort, pagination), `distinctValues()`
  (facets), `getMetaBySlug()` (locale fallback). Opens the `.db` **read-only** with
  `bun:sqlite`, or `node:sqlite` on Node ≥ 22 (e.g. Vercel); prepared-statement cache +
  memoized opens. Exported only from `@virtus/hyper-down/server`.
- **Client (views)**: `createContentResolver(contentModules[type])` resolves the lazy MDX
  React component for a `slug`+`lang`; rendered with `MdxRender`. No database code ever
  reaches the browser bundle.

**Plugins / adapters**: `hyperdownMdxPlugin` (wraps `@mdx-js/rollup`, intercepts
`*.mdx?raw`; **must be registered before the framework plugins**) ·
`hyperdownSitemapPlugin` (sitemap from config) · `withHyperDown` /
`runHyperDownNextCodegen` (`@virtus/hyper-down/next`) · `@virtus/hyper-down/drizzle`
(optional Drizzle proxy over the same SSR client).

### HyperJson — typed JSON engine

1. **Validation** (Ajv + ajv-formats, `strict` by default): every `.json` under a content
   folder is checked against its sibling `schema.json` at build time
   (`hyperjsonValidationPlugin`); failures exit non-zero.
2. **Codegen** (`HyperJsonCodegen`): compiles each schema with the in-process
   `json-schema-to-typescript` API through a bounded parallel pool
   (`HYPERJSON_CONCURRENCY`), emitting per-type ambient `declare module` types plus a
   `generated.d.ts` barrel — so `import data from "@content/<type>/<file>.json"` is fully
   typed. Writes **only** into the consuming app's `.hyper-json/`.
3. **Hooks** (`@virtus/hyper-json/hooks`): pure in-memory React hooks — `useFilter`,
   `useSort`, `useSearch`, `usePaginate`, `useComposed`.

### create-virtus-app — scaffolder

Overlays `templates/_shared/` (content, e2e suite, configs) with `templates/<id>/`
(framework-specific code), applying token replacement (`__PROJECT_NAME__`, and
Markdown-safe `{{PROJECT_NAME}}` inside `.md`). Every template ships the **same routes**
(`/`, `/articles[/:slug]`, `/cooking[/:slug]`, `/projects`, `/pt/*`) and the same
Playwright suite, so the four frameworks are interchangeable from a testing standpoint.
The harness (`bun run test:templates`) packs both engines as tarballs, scaffolds each
template, installs, builds, typechecks, and runs unit + e2e.

---

## Repository structure

```text
virtus/
├── packages/
│   ├── HyperDown/            @virtus/hyper-down
│   │   ├── src/
│   │   │   ├── frontmatter/  parser · validator · writer · codegen · SQL schema
│   │   │   ├── db/           ContentRepository · lazy proxy · SSR SQLite client
│   │   │   ├── components/   MdxRender · default MDX component maps · Mermaid
│   │   │   ├── hooks/        createContentResolver (browser-safe)
│   │   │   ├── plugins/      hyperdownPlugin · mdx · sitemap · next adapter
│   │   │   └── drizzle/      optional drizzle-orm re-exports
│   │   ├── cli/              `hyperdown` (commander + @clack/prompts)
│   │   ├── mcp/              `hyperdown-mcp` (stdio MCP server)
│   │   ├── schemas/          bundled JSON Schemas (config + FrontMatter CMS)
│   │   └── .agents/          rules + skills for AI agents
│   ├── HyperJson/            @virtus/hyper-json
│   │   ├── src/              codegen · lib (config/validate) · hooks · plugins
│   │   ├── cli/  mcp/  schemas/  .agents/
│   ├── scaffold/             create-virtus-app
│   │   ├── src/              CLI · template registry · scaffold engine
│   │   ├── templates/        _shared + vike + react-router + tanstack + next
│   │   └── scripts/          test-templates harness · gen-examples
│   └── configs/              shared tsconfig / oxlint / oxfmt / tailwind presets
├── examples/                 generated reference apps (one per template)
└── .github/workflows/        release.yml — npm publish + tag/release on push to main
```

### What a consuming app looks like

```text
my-app/
├── content/
│   ├── article/              HyperDown collection (Markdown/MDX)
│   │   ├── en/hello.mdx      locale folders; slug = filename
│   │   └── pt-BR/ola.mdx
│   └── projects/             HyperJson collection (JSON)
│       ├── schema.json       JSON Schema — drives validation + generated types
│       └── en/projects.json
├── .hyper-down/              generated — types/builder/modules per type (do not edit)
├── .hyper-json/              generated — ambient types (do not edit)
├── frontmatter.json          content-type definitions (FrontMatter CMS format)
├── hyperdown.config.json     HyperDown config (contentDir, sitemap, i18n)
├── hyperjson.config.json     HyperJson config (contentDir, validation)
└── vite.config.ts            hyperdownMdxPlugin → framework → hyperdownPlugin → …
```

---

## Configuration

### `hyperdown.config.json`

```jsonc
{
  "$schema": "./node_modules/@virtus/hyper-down/schemas/hyperdown.config.schema.json",
  "database": {
    "contentDir": "./content", // where .mdx lives; also the .hyper-down/ output root
    "frontmatterJsonPath": "frontmatter.json", // relative to THIS config file
  },
  "sitemap": {
    "siteUrl": "https://example.com",
    "outputPath": "./public/sitemap.xml",
    "staticRoutes": [{ "path": "/", "priority": "1.0", "changefreq": "weekly" }],
    "contentTypes": [{ "name": "article", "basePath": "/articles", "priority": "0.7" }],
  },
  "i18n": { "defaultLocale": "en", "locales": ["en", "pt-BR"] },
}
```

### `frontmatter.json` (FrontMatter CMS format)

- `frontMatter.content.pageFolders[]` — `{ title, path, contentTypes, defaultLocale,
locales }`. The first `contentTypes` entry names the SQLite table and the
  `content/<name>/` folder.
- `frontMatter.taxonomy.contentTypes[]` — `{ name, fields: [{ name, type, required }] }`.
  Storage mapping: `draft` → INTEGER (no FTS) · `datetime` → TEXT (no FTS) ·
  `tags`/`categories` → TEXT JSON array (flattened into FTS + tags bridge) · everything
  else → TEXT (FTS-indexed).

### `hyperjson.config.json`

```jsonc
{
  "$schema": "./node_modules/@virtus/hyper-json/schemas/hyperjson.config.schema.json",
  "contentDir": "content", // the only required field
  "validation": { "strict": true, "failOnError": true },
}
```

Scaffold any of these with the CLIs (`hyperdown init` / `hyperjson init`) — or start from
a full app:

```bash
bun create virtus-app my-app          # interactive
bunx create-virtus-app my-app --vike  # non-interactive (--react-router | --tanstack | --next)
```

---

## CLIs & MCP servers

```bash
hyperdown init|validate|update|gen:db|create-content|create-frontmatter|create-item
hyperjson init|validate|generate|create-content-type
```

| MCP server (stdio) | Tools                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hyperdown-mcp`    | `hyperdown_init` · `hyperdown_validate` · `hyperdown_update` · `hyperdown_gen_db` · `hyperdown_create_content` · `hyperdown_create_frontmatter` · `hyperdown_create_item` |
| `hyperjson-mcp`    | `hyperjson_init` · `hyperjson_validate` · `hyperjson_generate` · `hyperjson_create_content_type`                                                                          |

Creation tools require their full flag set — interactive prompts are disabled under MCP.
Each package also ships a `.agents/` tree (rules + skills) for agents working in a repo
that installs it.

---

## Development

> Requires **Bun** (the package manager is pinned to `bun@1.3.5`).

```bash
bun install

bun run build            # turbo run build (all packages, tsdown)
bun run typecheck        # turbo run typecheck
bun run test             # turbo run test (bun test in each package)
bun run check            # oxlint + oxfmt across the repo
bun run test:templates   # full scaffold harness: 4 templates × (build + typecheck + unit + e2e)
bun run gen:examples     # regenerate examples/<id>/ from the templates
```

Tooling is **OXC** (`oxlint` + `oxfmt`) — not ESLint, Prettier, or Biome. Library builds
use [tsdown](https://tsdown.dev/) (Rolldown-powered).

### Releases

Pushing to `main` runs [`release.yml`](./.github/workflows/release.yml): for each engine
whose `package.json` version is not on the npm registry yet, it builds, publishes
(`npm publish --access public`), and creates the matching tag + GitHub Release
(`hyper-down-vX.Y.Z` / `hyper-json-vX.Y.Z`). Bump a version, push, done.

## License

[MIT](./LICENSE) © Zaú Júlio
