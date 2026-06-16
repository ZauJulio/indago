# Agent Guidelines

## STRICT MANDATORY PROCEDURE FOR CODE EDITS

Whenever you (the AI agent) edit, modify, refactor, or add **CODE** to this repository, you **MUST** run the following commands **in order**:

1. **`bun run check`** — `oxlint` + `oxfmt`. ⚠️ This project uses **OXC**, NOT Biome or ESLint.
2. **`bun run typecheck`** — TypeScript across the monorepo.
3. **`bun run test`** — all test suites.
4. **`bun run build`** — ensures the project builds without errors.

If **any** command fails or produces **ANY** warnings or errors, fix them before considering the task complete. **Do not ask for permission to fix errors — just fix them, then rerun the checks.**

After modifying any file in a package's `schemas/`, run that package's `bun run gen:types` first.

---

## Repository shape

Bun + Turborepo monorepo (`workspaces: packages/*`). Two engines, a scaffolder, one shared-config package:

```text
packages/
  HyperDown/   @indago/hyper-down   src/{frontmatter,db,components,hooks,plugins,drizzle} + cli/ + mcp/ + schemas/ + .agents/
  HyperJson/   @indago/hyper-json   src/{codegen,lib,hooks,plugins,utils} + cli/ + mcp/ + schemas/ + .agents/
  scaffold/    @indago/create-app    src/ + templates/{_shared,vike,react-router,tanstack,next} + scripts/
  configs/     @repo/configs        tsconfig base · .oxlintrc · .oxfmtrc · tailwind · vite presets
examples/      generated reference apps (gen:examples; tarball-linked engines, partially gitignored)
.github/workflows/release.yml   npm publish + tag/release per engine on push to main
```

The two engines are **independent** (no cross-dependency). Builds use **tsdown** (Rolldown). Each engine ships a Vite plugin, a CLI (`hyperdown` / `hyperjson`), bundled JSON Schemas, an MCP stdio server, and a `.agents/` reference tree. The reference consumer is the separate [portifolio](https://github.com/ZauJulio/portifolio) repo (flat, installs the engines from npm).

### Useful commands

```bash
bun run test:templates                 # scaffold harness: 4 templates × build+typecheck+unit+e2e
bun run gen:examples                   # regenerate examples/<id>/
bun --cwd packages/HyperDown cli ...   # run a CLI from source (also: cli:init, cli:validate, …)
bun --cwd packages/HyperDown run gen:types   # regen schema-types after editing schemas/
```

---

## Architecture Notes

### HyperDown (`packages/HyperDown`)

- **SSR-only.** SQLite is queried **exclusively on the server**, in server route loaders. There is no client-side database.
- **SQLite stores only frontmatter metadata** — the MD/MDX body is **never** stored (loads at render time via Vite globs). FTS5 tables are contentless (`content=""`): the body **is tokenized into the FTS index but never stored**. `tags`/`categories` are mirrored into an indexed `<type>_tags` bridge (sargable filters + facet counts).
- MD/MDX bodies load via **static** `import.meta.glob` modules, codegen-generated into the consuming app's `.hyper-down/<contentDir>/<type>/modules.ts` (+ `default.ts` barrel exporting `contentModules`). The glob is a static string literal; `{ eager: true }` is **load-bearing** for SSG body inlining — lazy makes prerender flush the Suspense skeleton into HTML.
- **Drafts** (`src/frontmatter/draft.ts`): a `type: "draft"` field (name configurable) is a publish gate. When truthy, the item is excluded by the **writer** (no DB row/FTS), the **codegen** (its `.mdx` is added as a `!`-negation to the `import.meta.glob`, so it's never compiled into the bundle), and the **sitemap** — so an unpublished draft leaves no trace in the build and can't be slug-guessed. Shared detector reused by all three; `draft: false`/absent ⇒ published.
- **`hyperdownMdxPlugin`** wraps `@mdx-js/rollup` and intercepts `*.mdx?raw` (MDX strips the query before exclude filters run). **It MUST be listed before the framework plugins** in the consumer's Vite config.
- **`ContentRepository<T>` (`src/db/repository.ts`)**: `search()` (FTS5 `MATCH` + filters + sort + pagination), `distinctValues()` (facets), `getMetaBySlug()` (locale fallback, single `locale IN (?,?)` query), `related()` (tag-ranked suggestions — `MIN(CASE)` over the `<type>_tags` bridge ranks candidates by the position of the highest-priority shared tag; source slug excluded; SQL/binds built by the pure `buildRelatedQuery`). Filters are **exact-match or tag-bridge only — never LIKE**; free text goes through FTS5 MATCH (indexed). Search matches FTS across **all locales**, mapped back to slugs, returning one row per slug in the requested `locale`. Two-query pagination (uncorrelated scalar `_total_count` subquery; no `COUNT(*) OVER`). Exported only from **`@indago/hyper-down/server`**.
- Codegen emits `builder.ts` with a **lazy `<type>Repository` Proxy** (`createLazyRepository`): the `new` is deferred past module evaluation to dodge a Rolldown chunk init-order race (intermittent `undefined is not a constructor` SSR 500s). Keep `lazy-repository`'s ContentRepository import **dynamic**; loaders import the generated repository, never the class.
- **`createContentResolver(modules)`** (single argument — a `contentModules[type]` map) is the browser-safe view-layer counterpart → returns `getContent(slug, lang)`; render with `MdxRender`.
- **SSR SQLite (`src/db/client/ssr.ts`)**: `bun:sqlite`, or `node:sqlite` on Node ≥ 22 (e.g. Vercel) — runtime-detected, not try/catch. File-based read-only opens, memoized in-flight (concurrent cold requests await the same promise), prepared-statement cache. Production prefers `dist/metadata/<name>.db`, gated to `NODE_ENV !== "development"` so a stale `dist` never shadows the fresh dev DB. `data:`-inlined DBs are materialized to a temp file.
- **Vite plugin (`hyperdownPlugin`)**: codegen on `buildStart` (idempotent byte-identical skips), then spawns the writer (`bun` subprocess) per collection; on `closeBundle` (**build only** — vitest boots Vite with the throwaway outDir `dummy-non-existing-folder`) copies every `.db` into `dist/metadata/`. `hyperdownSitemapPlugin` writes the sitemap from `hyperdown.config.json#sitemap`.
- **Writer is OOP-decomposed** (`src/frontmatter/`): `HyperDownWriter` (orchestrator, pools collections) → `CollectionDbBuilder` (parallel read/parse/validate via `runPool`, then serial single-transaction persist) → `CollectionSchema` (pure DDL from field defs).
- **CLI `gen:db` runs the codegen itself before the writer** (the writer gates on `.hyper-down/**/types.ts` existing) and **awaits** `writeDatabases()` — self-sufficient on a fresh checkout.
- Next.js adapter (`@indago/hyper-down/next`): `withHyperDown` (next.config wrapper) + `runHyperDownNextCodegen` (predev/prebuild; rewrites `modules.ts` to explicit `@next/mdx` imports — Next has no Vite glob transform).
- `@indago/hyper-down/drizzle`: optional Drizzle proxy over the same SSR client; `getDrizzleDb` logs **and rethrows** query errors.
- **mermaid** is an optional peer typed via the local ambient `src/components/mermaid.d.ts` (not shipped in dist). ⚠️ bun does **not** install a devDependency that is also an optional peer — don't "fix" this by adding mermaid to devDependencies.

### HyperJson (`packages/HyperJson`)

- Validates JSON content against per-folder `schema.json` at build time (`hyperjsonValidationPlugin` from `@indago/hyper-json/plugins`); `strict` rejects unknown properties, `failOnError` exits non-zero.
- Codegen (`HyperJsonCodegen`, `src/codegen.ts`): **in-process** `json-schema-to-typescript` API, bounded parallel pool (`HYPERJSON_CONCURRENCY`). Writes **only into the consuming app's `.hyper-json/`** — never into the installed package (the package's own `src/lib/types.ts` is dev-time codegen via `scripts/gen-types.ts`, run on prebuild).
- Provides `virtual:hyperjson-config` to Vite consumers and headless hooks (`@indago/hyper-json/hooks`: filter/sort/search/paginate/compose over in-memory JSON).
- No dependency on frontmatter — all frontmatter logic lives in HyperDown.

### Scaffold (`packages/scaffold`)

- Templates overlay `_shared` + `<id>`; token replacement via `__PROJECT_NAME__`/`__TEMPLATE_ID__` plus **Markdown-safe `{{PROJECT_NAME}}`/`{{TEMPLATE_ID}}` inside `.md` files** (formatters/markdownlint mangle `__x__` into bold — that bug shipped once).
- Test script is pinned to `bun test __tests__/scaffold` — a bare `bun test` would also match `templates/_shared/__tests__/content.test.ts` (it ships to generated apps and cannot run here).
- Harness (`scripts/test-templates.ts`): packs both engines as tarballs, scaffolds each template into a temp dir, links the tarballs, installs, builds, typechecks, runs unit + Playwright e2e. Every template ships the same routes and specs.
- React Router template's Docker runner must be **node:24-alpine**, not Bun (`react-router-serve` crashes on `react-dom/server.bun.js`).

### Tests (repo-wide)

- `bun test` everywhere; HyperDown component tests use happy-dom + Testing Library. The root `bunfig.toml` preloads `bun-setup.ts`, which **mocks the `virtual:hyperdown-*` modules** — without it any test touching the SSR client import graph fails resolution.
- E2E lives in the scaffold templates (Playwright), exercised via `bun run test:templates`.

### Releases (`.github/workflows/release.yml`)

- On push to `main` (or manual dispatch), per package — `@indago/hyper-down`, `@indago/hyper-json`, `@indago/create-app` (`@repo/configs` is private, never published): skip if `package.json` version already on the registry; else build + `npm publish --access public` (secret `NPM_TOKEN`) + `gh release create <prefix>-vX.Y.Z` (`hyper-down-v` / `hyper-json-v` / `create-app-v`). The registry check is the change gate — touching only package A never re-tags/re-publishes B. Existing tags and releases are also checked, so reruns are safe (idempotent skips). `id-token: write` is already granted for the future npm Trusted Publishing migration.
- To release: bump the package's `version`, push to `main`.

### Auto-generated Files — Do Not Edit Manually

- `packages/HyperDown/src/frontmatter/schema-types.ts` (regen: `gen:types`; note the committed copy is oxfmt-formatted — re-run `bun run check` after regenerating)
- `packages/HyperDown/types.d.ts`, `packages/HyperJson/types.d.ts`, `packages/HyperJson/src/lib/types.ts`
- consuming apps' `.hyper-down/**` and `.hyper-json/**` trees
