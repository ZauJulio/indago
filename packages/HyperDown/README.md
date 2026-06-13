# HyperDown

<p align="center">
  <img src="./assets/logo.svg" alt="HyperDown — Honos et Indago" width="120" height="120" />
</p>

<p align="center">
  <strong>Markdown/MDX → SQLite (FTS5 contentless) → server-side route loaders.</strong><br/>
  A drop-in <em>SSR headless CMS</em> for Vike, React Router, TanStack Start, and Next.js — zero backend service.
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.4.0-blue" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" />
  <img alt="vite" src="https://img.shields.io/badge/vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="react" src="https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=white" />
</p>

---

## What is HyperDown?

HyperDown turns a folder of Markdown / MDX files into a queryable, full-text-searchable
content store — **without a server, a database service, or a build-time content
graph baked into your JavaScript bundle**.

At build time it parses the front-matter of every content file and writes a compact
**SQLite** database that holds _only the metadata_ (title, tags, dates, slug, locale,
…). **At request time your server-side route loaders query that database** — Vike
`+data`, React Router / TanStack Start loaders, or Next.js server components; there is
no client-side database:

- The OOP **`ContentRepository`** runs **FTS5** full-text search, filters, sorting,
  pagination, and by-slug lookups, reading the `.db` from disk with `bun:sqlite` (or
  `node:sqlite` on Node ≥ 22 / Vercel).
- Listing routes are URL-driven (`?q`, `?tag`, `?page`, `?sort`); the loader re-runs
  server-side on each change. Detail routes return serializable metadata.

The Markdown/MDX _body_ is never stored in SQLite. It is loaded lazily in the route
component via Vite's `import.meta.glob` (the browser-safe `createContentResolver`),
compiled to a React component by `@mdx-js/rollup`, and rendered with `MdxRender`.

The result: a strongly-typed, searchable, internationalised content layer with no
backend service, served via SSR (pre-rendered to static HTML by default).

> **Starting fresh?** `bun create @indago/app` scaffolds a ready-made app (Vike,
> React Router v7, TanStack Start, or Next.js) already wired to HyperDown + HyperJson.

---

## Feature highlights

- 📝 **Markdown & MDX** content, compiled to React components.
- 🔍 **FTS5 full-text search** with prefix matching, filters, sorting, and pagination.
- 🗜️ **Compact `.db`** — contentless FTS5 (`content=""`) stores only the inverted
  index, never the original text.
- 🖥️ **SSR-only** — SQLite is queried in route loaders via `bun:sqlite` / `node:sqlite`;
  no client database, no Web Worker, no OPFS.
- 🧱 **OOP data layer** — a typed `ContentRepository<T>` for search / facets / by-slug.
- 🌍 **i18n** with folder-based locales and automatic locale fallback.
- ⚙️ **Vite plugins** for database generation, MDX compilation, and sitemap output.
- 🧰 **Full CLI** (`hyperdown`) to scaffold, validate, and generate everything.
- 🤖 **MCP server** (`hyperdown-mcp`) exposing the CLI as tools for AI agents.
- 🧬 **Schema-driven types** generated from [Front Matter CMS](https://frontmatter.codes/)
  schemas, with first-class editor integration.

---

## Installation

```bash
# bun (recommended)
bun add @indago/hyper-down

# npm / pnpm / yarn
npm install @indago/hyper-down
```

### Peer dependencies

HyperDown expects these to be provided by the consuming app:

| Peer            | Range                  | Notes                                                   |
| --------------- | ---------------------- | ------------------------------------------------------- |
| `react`         | `^19.2.6`              | required                                                |
| `react-dom`     | `^19.2.6`              | required                                                |
| `react-i18next` | `^16.5.4 \|\| ^17.0.0` | drives locale resolution in hooks                       |
| `vite`          | `^8.0.14`              | required for the plugins                                |
| `mermaid`       | `>=10`                 | **optional** — only needed if you render Mermaid blocks |

> **Runtime note:** route loaders read SQLite through `bun:sqlite` (or `node:sqlite`
> on Node ≥ 22, e.g. Vercel), so server-side rendering runs on Bun or Node ≥ 22.
> `node >= 20` is required for the CLI and Vite plugins.

---

## Quick start

### 1. Scaffold the config files

```bash
bunx @indago/hyper-down init both
```

This creates `hyperdown.config.json` and `frontmatter.schema.json` in the current
directory. (See [Configuration reference](#configuration-reference).)

### 2. Wire up the Vite plugins

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import {
  hyperdownPlugin,
  hyperdownMdxPlugin,
  hyperdownSitemapPlugin,
} from "@indago/hyper-down/plugins";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // MDX compilation MUST run before the router scan.
    hyperdownMdxPlugin({ remarkPlugins: [remarkGfm] }),
    reactRouter(),
    hyperdownPlugin(), // validates config + generates the SQLite DB(s)
    hyperdownSitemapPlugin(), // writes public/sitemap.xml on build
  ],
  // SSR-only: bundle the package server-side so its `virtual:*` imports resolve;
  // keep the SQLite builtins external (loaded lazily in the loader path).
  ssr: {
    external: ["bun:sqlite", "node:sqlite"],
    noExternal: ["@indago/hyper-down"],
  },
  optimizeDeps: {
    exclude: ["@indago/hyper-down"],
  },
});
```

Add the `@hyper-down/*` path alias so the codegen-generated module maps resolve:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": { "@hyper-down/*": ["./.hyper-down/*"] },
  },
  "include": ["src/**/*", ".hyper-down/**/*"],
}
```

Set `ssr: true` in `react-router.config.ts` — HyperDown queries SQLite only in route
loaders, so the content routes must be server-rendered (the default build still
prerenders them to static HTML).

### 3. Add content

```bash
bunx @indago/hyper-down create-content --name article --folder Articles --fields "title:string:req,tags:tags:opt"
bunx @indago/hyper-down create-item --type article --slug hello-world --lang en
```

```mdx
---
title: "Hello, world"
date: 2026-01-01T12:00:00Z
tags:
  - intro
---

Welcome to HyperDown. This body is **never** stored in SQLite — it is loaded lazily.
```

### 4. Set up the data layer

The build codegen writes everything you need into the app's `.hyper-down/` tree
(aliased as `@hyper-down/*`):

- `<contentDir>/<type>/builder.ts` — a **server-only**, lazily-instantiated
  `<type>Repository` (a `ContentRepository<Meta>` proxy). Import it **only from
  loaders** (e.g. a `*.server.ts` module) so the SQLite client never reaches the
  client bundle.
- `<contentDir>/<type>/modules.ts` + `default.ts` — the static `import.meta.glob`
  map of MDX bodies, exposed as `contentModules`, for the browser-safe resolver.

```ts
// src/pages/articles/data.ts  (browser-safe — imported by components)
import { contentModules } from "@hyper-down/default";
import { createContentResolver } from "@indago/hyper-down";

// Resolves the lazy MDX body component for a slug+lang.
export const getArticleContent = createContentResolver(contentModules["article"]);
```

```ts
// src/pages/articles/data.server.ts  (server-only — imported by loaders)
export { articleRepository } from "@hyper-down/content/article/builder";
```

### 5. Query in loaders, render in components

```tsx
// src/pages/articles/[slug].tsx
import { MdxRender } from "@indago/hyper-down";
import { getArticleContent } from "./data";
import { articleRepository } from "./data.server";
import type { Route } from "./+types/[slug]";

export async function loader({ params }: Route.LoaderArgs) {
  return articleRepository.getMetaBySlug(params.slug, "en"); // serializable metadata
}

export default function ArticlePage({ loaderData: article }: Route.ComponentProps) {
  if (!article) return <p>Not found.</p>;
  const Body = getArticleContent(article.slug, article.lang);

  return (
    <article>
      <h1>{article.title}</h1>
      <MdxRender content={Body} fallback={<p>Rendering…</p>} />
    </article>
  );
}
```

---

## Programmatic API

The package exposes four entry points via its `exports` map:

| Import                       | Provides                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@indago/hyper-down`         | Browser-safe surface: `createContentResolver`, `MdxRender`, MDX components, parser, i18n utils, content types. |
| `@indago/hyper-down/server`  | Server-only runtime: `ContentRepository`, `createLazyRepository`, `hyperDownClient`.                           |
| `@indago/hyper-down/types`   | Raw content types (`ContentItem`, `ContentMeta`, `MdxComponent`).                                              |
| `@indago/hyper-down/plugins` | Vite plugins: `hyperdownPlugin`, `hyperdownMdxPlugin`, `hyperdownSitemapPlugin`.                               |
| `@indago/hyper-down/next`    | Next.js adapter: `withHyperDown` (next.config wrapper), `runHyperDownNextCodegen` (predev/prebuild).           |
| `@indago/hyper-down/drizzle` | Re-exports of `drizzle-orm/sqlite-core` plus `sql`, `eq`, `and`, `or`, `desc`, `asc`, `inArray`.               |

### `ContentRepository<T>` (server-side)

The OOP data-access object for one content collection, imported from
`@indago/hyper-down/server`. **Use it only in route loaders** (ideally from a
`*.server.ts` module). Every method queries the generated `.db` through
`bun:sqlite` / `node:sqlite`.

Prefer the codegen-generated `<type>Repository` (`@hyper-down/<contentDir>/<type>/builder`)
— a `createLazyRepository` proxy that defers construction past module evaluation. If you
instantiate manually:

```ts
import { ContentRepository } from "@indago/hyper-down/server";

const articleRepository = new ContentRepository<ArticleMeta>({
  contentName: "article",
  // ftsTable?: defaults to `${contentName}_fts`
});

// FTS5 + filters + sort + pagination — returns serializable metadata.
const { results, totalCount, totalPages, currentPage } = await articleRepository.search({
  locale: "en",
  searchQuery: "react",
  filters: { tag: "typescript" }, // `tag` resolves via the indexed tags bridge; others are exact match
  sort: { sortBy: "date", sortDir: "desc" },
  pagination: { page: 1, pageSize: 10 },
});

// Distinct column values for filter UIs.
const tags = await articleRepository.distinctValues(
  { column: "tags", isJson: true, sortByFrequency: true },
  "en",
);

// Metadata-only lookup by slug (JSON-serializable; locale fallback applied).
const article = await articleRepository.getMetaBySlug("hello-world", "en");
```

| `ContentSearchParams` field | Type                                           | Default                  |
| --------------------------- | ---------------------------------------------- | ------------------------ |
| `locale`                    | `string`                                       | — (omit for all locales) |
| `searchQuery`               | `string`                                       | `""`                     |
| `filters`                   | `Record<string, string \| undefined>`          | `{}`                     |
| `sort`                      | `{ sortBy: string; sortDir: "asc" \| "desc" }` | —                        |
| `pagination`                | `{ page: number; pageSize: number }`           | —                        |

> The FTS match runs **across all locales** and maps back to slugs, so "slow" and
> "lenta" surface the same article; the `locale` filter then returns one row per slug in
> the requested locale. Filter values of `undefined`, `""`, and `"All"` are skipped —
> convenient placeholders for "no filter". `sort.sortBy` is interpolated into the SQL
> `ORDER BY`, so pass only allow-listed column keys.

### `createContentResolver(modules)` (browser-safe)

The view-layer counterpart of `ContentRepository`. Returns a `getContent(slug, lang)`
function that resolves the lazy MDX React component from the module map. It touches no
database code, so route **components** import it to render the body for the metadata a
loader returned.

```ts
import { contentModules } from "@hyper-down/default";
import { createContentResolver } from "@indago/hyper-down";

export const getArticleContent = createContentResolver(contentModules["article"]);
```

> **`modules` is the codegen-generated map** from `@hyper-down/default`
> (`contentModules`, keyed by content-type name). It is the result of a static
> `import.meta.glob()` emitted into app-owned `.hyper-down` code — Vite cannot resolve
> dynamic template-literal globs, and the glob must live in app code, never inside the
> library.

### `MdxRender`

```tsx
import { MdxRender } from "@indago/hyper-down";

<MdxRender
  content={data.content} // MdxComponent | null
  components={[myOverrides]} // merged on top of defaultMdxComponents (last wins)
  disableDefaults={false} // true → use ONLY the provided maps
  fallback={<Spinner />} // shown while the lazy component loads
  empty={<NotFound />} // shown when content is null
/>;
```

Component-map helpers:

- `defaultMdxComponents` — an opinionated default element map (headings, links, code,
  blockquote, tables, images, …).
- `createMdxComponents(maps?, { disableDefaults? })` — resolves the final map:
  `undefined` → defaults only, `[]` → empty map, `[...]` → defaults merged with each map.
- `MermaidBlock` — renders a Mermaid diagram from a fenced ` ```mermaid ` code block
  (requires the optional `mermaid` peer dependency).

### Parser & i18n utilities

```ts
import {
  parseFrontmatter, // (raw: string) => { data, content }
  getLocale, // (i18n?) => canonical DB locale ("en" | "pt-BR")
  getDisplayLocale, // (lang?) => BCP 47 locale for Intl APIs
  getFallbackLocale, // (lang)  => the other locale (en ↔ pt-BR)
} from "@indago/hyper-down";
```

### Vite plugins

#### `hyperdownPlugin({ configPath? })`

The core plugin. On `buildStart` it validates `hyperdown.config.json`, runs the
`.hyper-down/**` codegen (types/builder/modules — idempotent writes), and spawns the
writer to generate one SQLite database per content type. On `closeBundle` (build only)
it copies each `.db` into `dist/metadata/` so the built output is self-contained. It
also serves several **virtual modules**:

| Virtual module                  | Default export                                                    |
| ------------------------------- | ----------------------------------------------------------------- |
| `virtual:hyperdown-config`      | The parsed `hyperdown.config.json`.                               |
| `virtual:hyperdown-frontmatter` | The parsed `frontmatter.json`.                                    |
| `virtual:hyperdown-collections` | `getCollectionConfig(name)` → lazy import of the per-type config. |
| `virtual:hyperdown/<type>`      | `{ dbUrl }` (the `.db` asset URL) for a content type.             |

These virtual modules are how the server-side SQLite client resolves the right `.db` URL
at request/prerender time — you generally do not import them directly.

`configPath` defaults to `hyperdown.config.json` next to your `vite.config.ts`.

#### `hyperdownMdxPlugin(options?)`

Wraps `@mdx-js/rollup` with `enforce: "pre"` and a built-in `rehypeDropRawHtml` rehype
plugin. Pass your own remark/rehype plugins through:

```ts
hyperdownMdxPlugin({
  remarkPlugins: [remarkMath, remarkFrontmatter, remarkGfm],
  rehypePlugins: [rehypeSlug, [rehypeKatex, { output: "html" }], rehypeHighlight],
});
```

> Place `hyperdownMdxPlugin()` **before** `reactRouter()` so `.mdx` files are compiled to
> React components before the router's file-system scan runs.

#### `hyperdownSitemapPlugin({ configPath? })`

Build-only plugin (`apply: "build"`). On `closeBundle` it reads the `sitemap` section of
`hyperdown.config.json`, walks the content directory, and writes `sitemap.xml`. Locale
prefixes (`/pt`, …) are derived from the i18n `strategy` (`folder`) or `filePattern`.

---

## CLI reference

The `hyperdown` binary is installed with the package. Run it via `bunx @indago/hyper-down <command>`
(or `npx`, etc.). Commands are interactive where it makes sense and fully scriptable via
flags.

```text
hyperdown <command> [target] [options]
```

| Command                                               | Summary                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| [`init [target]`](#hyperdown-init)                    | Scaffold `hyperdown.config.json` and/or `frontmatter.schema.json`.     |
| [`validate [target]`](#hyperdown-validate)            | Validate config and/or `frontmatter.json` against the bundled schemas. |
| [`update [target]`](#hyperdown-update)                | Download Front Matter CMS schemas and regenerate `schema-types.ts`.    |
| [`gen:db`](#hyperdown-gendb)                          | Generate the SQLite database(s) from front-matter content.             |
| [`create-content`](#hyperdown-create-content)         | Add a content type to `frontmatter.json` and scaffold a template.      |
| [`create-frontmatter`](#hyperdown-create-frontmatter) | Create a fresh `frontmatter.json` with content types + i18n.           |
| [`create-item`](#hyperdown-create-item)               | Create a new `.mdx` content item.                                      |

<h3 id="hyperdown-init"><code>init [target]</code></h3>

Scaffolds config files. `target` is one of `config`, `frontmatter`, or `both`
(default: `both`). Existing files are left untouched.

```bash
bunx @indago/hyper-down init both
bunx @indago/hyper-down init config
```

<h3 id="hyperdown-validate"><code>validate [target]</code></h3>

Validates `hyperdown.config.json` and/or `frontmatter.json` against the schemas bundled
with the package. Exits non-zero on the first invalid file. `target` is `config`,
`frontmatter`, or `both` (default: `both`).

The path flag defaults per `target`: `./hyperdown.config.json` for `config`,
`./frontmatter.json` for `frontmatter`. It is ignored when `target` is `both`.

| Option              | Default        | Description                                                                         |
| ------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `-p, --path <path>` | target default | Path to the file matching `target` (`config` or `frontmatter`). Ignored for `both`. |

```bash
bunx @indago/hyper-down validate
bunx @indago/hyper-down validate config --path ./apps/web/hyperdown.config.json
```

<h3 id="hyperdown-update"><code>update [target]</code></h3>

Downloads the official Front Matter CMS JSON schemas, patches their `$ref`s, and
regenerates the TypeScript interfaces in `src/frontmatter/schema-types.ts`. `target`
defaults to `schemas`. **Network access is required.**

| Option                | Default                                        | Description                                      |
| --------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `-o, --output <path>` | `src/frontmatter/schema-types.ts` (in-package) | Output path for the generated `schema-types.ts`. |

```bash
bunx @indago/hyper-down update schemas
bunx @indago/hyper-down update --output ./types/frontmatter-schema-types.ts
```

<h3 id="hyperdown-gendb"><code>gen:db</code></h3>

Runs the `.hyper-down/**` codegen, then generates the SQLite database(s) from your
front-matter content — self-sufficient on a fresh checkout (no prior build needed).

| Option              | Default                   | Description                      |
| ------------------- | ------------------------- | -------------------------------- |
| `-p, --path <path>` | `./hyperdown.config.json` | Path to `hyperdown.config.json`. |

```bash
bunx @indago/hyper-down gen:db
bunx @indago/hyper-down gen:db --path ./apps/web/hyperdown.config.json
```

<h3 id="hyperdown-create-content"><code>create-content</code></h3>

Adds a content type to an existing `frontmatter.json`, writes a Front Matter template,
creates an example `.mdx`, and runs codegen (`update schemas` + `gen:db`). Interactive
when `--name` is omitted.

| Option              | Default                   | Description                                       |
| ------------------- | ------------------------- | ------------------------------------------------- |
| `--name <name>`     | —                         | Content type name (lowercase, numbers, `-`, `_`). |
| `--folder <folder>` | —                         | Plural folder title (e.g. `Articles`).            |
| `--fields <fields>` | —                         | Comma-separated `name:type:req\|opt` definitions. |
| `-p, --path <path>` | `./hyperdown.config.json` | Path to the config file.                          |

Field syntax — `name:type:req|opt` (the `req|opt` suffix is **mandatory**; malformed
entries are silently skipped). Types: `string`, `number`, `boolean`, `datetime`,
`draft`, `tags`, `categories`, `image`, `choice[a|b|c]`.

```bash
bunx @indago/hyper-down create-content \
  --name product \
  --folder Products \
  --fields "title:string:req,price:number:opt,status:choice[draft|published]:req"
```

<h3 id="hyperdown-create-frontmatter"><code>create-frontmatter</code></h3>

Creates a brand-new `frontmatter.json` (with content types + i18n locales) and the
matching locale directories. Interactive when `--name` is omitted; otherwise it generates
a default content type with `title`, `description`, `date`, `draft`, and `tags` fields.

| Option                | Default            | Description                                       |
| --------------------- | ------------------ | ------------------------------------------------- |
| `--name <name>`       | —                  | Content type name (enables non-interactive mode). |
| `--locales <locales>` | `en`               | Comma-separated locale codes.                     |
| `--content-dir <dir>` | `src/content`      | Content directory path.                           |
| `-o, --output <path>` | `frontmatter.json` | Output file path.                                 |

```bash
bunx @indago/hyper-down create-frontmatter --name post --locales "en,pt-BR" --output frontmatter.json
```

<h3 id="hyperdown-create-item"><code>create-item</code></h3>

Creates a new `.mdx` file for an existing content type, seeded with that type's
front-matter fields. Interactive when `--type`, `--slug`, or `--lang` is omitted.

| Option              | Default                   | Description                             |
| ------------------- | ------------------------- | --------------------------------------- |
| `--type <type>`     | —                         | Content type name.                      |
| `--slug <slug>`     | —                         | File slug (filename without extension). |
| `--lang <lang>`     | `en`                      | Locale code.                            |
| `-p, --path <path>` | `./hyperdown.config.json` | Path to the config file.                |

```bash
bunx @indago/hyper-down create-item --type article --slug hello-world --lang en
```

### MCP server

The package also ships `hyperdown-mcp` (declared in `bin`), an MCP **stdio** server that
exposes the CLI as tools so MCP-aware agents (Claude Desktop, Cursor, Continue, …) can
scaffold, validate, and generate without learning the CLI surface.

```bash
bunx --package @indago/hyper-down hyperdown-mcp
```

Tools: `hyperdown_init`, `hyperdown_validate`, `hyperdown_update`, `hyperdown_gen_db`,
`hyperdown_create_content`, `hyperdown_create_frontmatter`, `hyperdown_create_item`.
Creation tools require their full flag set — interactive prompts are disabled under MCP.

---

## Architecture notes

### SQLite holds only metadata

The generated database stores **front-matter metadata only** — never the Markdown/MDX
body. Each content type gets its own table (`id`, `slug`, `lang`, plus one column per
front-matter field) and a sibling **contentless FTS5** virtual table
(`<type>_fts USING fts5(..., content="", tokenize="unicode61")`). The FTS table indexes
the front-matter columns **plus the body text**, so full-text search reaches article
content — and because the table is contentless, the body is tokenized into the inverted
index but **never stored**, keeping the `.db` tiny.

`tags`/`categories` are stored as JSON strings in the main table, flattened into the FTS
index, and mirrored into an indexed `<type>_tags` bridge table for sargable tag filters
and facet counts.

### The body is loaded at runtime

MDX bodies are resolved by a **static** `import.meta.glob` — codegen-generated into the app's
`.hyper-down/<contentDir>/<type>/modules.ts` and exposed via `@hyper-down/default` — and wrapped
by `createContentResolver`. The matching module is compiled to a lazy React component and
rendered with `MdxRender`. Front-matter is stripped before rendering.

### SSR — `bun:sqlite` / `node:sqlite` from disk

SQLite is queried **only on the server**, in route loaders, via `ContentRepository`. The
underlying client lazily imports `bun:sqlite` (or `node:sqlite` on Node ≥ 22) and opens the
`.db` **read-only from the filesystem** — file-based, not an in-memory copy. Open `Database`
instances are cached across requests. Vite-inlined `data:` databases are materialized to a
temp `.db` first.

### `node:`-free browser bundle

All `node:*` access in the SSR client happens through dynamic `import()` inside its methods,
so the static import graph carries no Node built-ins. Route components import only the
browser-safe `createContentResolver` (and the framework strips loader-only modules from the
client bundle), so `node:fs`/`node:path`/`node:zlib` never reach the browser.

### MDX `?raw` bypass (built into `hyperdownMdxPlugin`)

`@mdx-js/rollup` strips the query string (`id.split('?')[0]`) before its `exclude` filter
runs, so `*.mdx?raw` imports would still be MDX-compiled. `hyperdownMdxPlugin` intercepts
those imports first and redirects them to a virtual module returning the raw source as
`export default "<string>"` — one of the reasons it must be registered before the
framework plugins.

### i18n & locale fallback

Locales are resolved in this order: `i18n.language` → `getLocale()` →
canonical DB locale (`"en"` / `"pt-BR"`). Slug lookups try the primary locale and fall
back to the other via `getFallbackLocale(lang)`.

---

## Configuration reference

### `hyperdown.config.json`

Validated against `schemas/hyperdown.config.schema.json`. The three top-level sections
(`database`, `sitemap`, `i18n`) are required.

```jsonc
{
  "$schema": "./node_modules/@indago/hyper-down/schemas/hyperdown.config.schema.json",
  "database": {
    "contentDir": "src/content", // base content directory (required)
    "frontmatterJsonPath": "frontmatter.json", // path to frontmatter.json (required)
    "outputPath": ".hyper-down/metadata.db", // optional
  },
  "sitemap": {
    "siteUrl": "https://example.com", // no trailing slash
    "outputPath": "./public/sitemap.xml",
    "staticRoutes": [{ "path": "/", "priority": "1.0", "changefreq": "weekly" }],
    "contentTypes": [
      { "name": "article", "basePath": "/articles", "priority": "0.7", "changefreq": "monthly" },
    ],
  },
  "i18n": {
    "defaultLocale": "en",
    "locales": ["en", "pt-BR"],
    "strategy": "folder", // currently only "folder"
    "filePattern": {},
  },
}
```

`priority` must match `^[01]\.\d$` (e.g. `"0.7"`, `"1.0"`); `changefreq` is one of
`always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`.

### `frontmatter.json`

HyperDown reuses the [Front Matter CMS](https://frontmatter.codes/) configuration shape.
The keys HyperDown reads are:

- `frontMatter.taxonomy.contentTypes` — content types and their fields. Each field has a
  `name`, `title`, `type` (`string`, `number`, `boolean`/`draft`, `datetime`, `tags`,
  `categories`, `image`, `choice`), and an optional `required`/`choices`.
- `frontMatter.content.pageFolders` — maps content types to directories and declares
  their locales (`defaultLocale`, `locales`).
- `frontMatter.content.i18n` — the locale list used to build the locale map.

Use `hyperdown create-frontmatter` / `create-content` to generate and extend this file
rather than editing it by hand.

> **Auto-generated files — do not edit:** `src/frontmatter/schema-types.ts`,
> `types.d.ts`, and the consuming app's `.hyper-down/**`
> (`<contentDir>/<type>/{types,builder,modules}.ts` + `default.ts`) are produced by
> codegen and will be overwritten. Run `bun run gen:types` after changing any schema in
> `schemas/`.

---

## License

[MIT](./LICENSE) © Zaú Júlio
