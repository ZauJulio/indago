# Agent Guidelines

## STRICT MANDATORY PROCEDURE FOR CODE EDITS

Whenever you (the AI agent) edit, modify, refactor, or add **CODE** to this repository, you **MUST** run the following commands **in order**:

1. **`bun run check`** — `oxlint` + `oxfmt`. ⚠️ This project uses **OXC**, NOT Biome or ESLint.
2. **`bun run typecheck`** — TypeScript across the monorepo.
3. **`bun run test`** — all test suites.
4. **`bun run build`** — ensures the project builds without errors.

If **any** command fails or produces **ANY** warnings or errors, fix them before considering the task complete. **Do not ask for permission to fix errors — just fix them, then rerun the checks.**

---

## Repository shape

Bun + Turborepo monorepo (`workspaces: packages/*`). Two engines, a scaffolder, one shared-config package:

- **`packages/HyperDown`** (`@virtus/hyper-down`) — Markdown/MDX → SQLite content engine. SSR-only.
- **`packages/HyperJson`** (`@virtus/hyper-json`) — JSON Schema → validation + TS codegen engine.
- **`packages/scaffold`** (`create-virtus-app`) — CLI scaffolder with 4 templates (vike / react-router / tanstack / next), all wired to both engines and sharing the same routes + e2e suite. `examples/` holds generated output (`bun run gen:examples`).
- **`packages/configs`** (`@repo/configs`) — shared tsconfig/oxlint/oxfmt/Tailwind/Vite presets.

The two engines are **independent** (no cross-dependency). Builds use **tsdown** (Rolldown). Each engine ships a Vite plugin, a CLI (`hyperdown` / `hyperjson`), its JSON Schemas, an MCP server, and a `.agents/` reference tree. The reference consumer is the separate [portifolio](https://github.com/ZauJulio/portifolio) repo.

---

## Architecture Notes

### HyperDown (`packages/HyperDown`)

- **SSR-only.** SQLite is queried **exclusively on the server**, in server route loaders. There is no client-side database.
- **SQLite stores only frontmatter metadata** — the raw MD/MDX body is **never** stored in SQLite (it loads at render time via Vite globs). FTS5 tables are contentless (`content=""`): the body **is tokenized into the FTS index but never stored**.
- MD/MDX bodies load via **static** `import.meta.glob` modules, codegen-generated into the consuming app's `.hyper-down/<contentDir>/<type>/modules.ts` (+ `default.ts` barrel exporting `contentModules`). The glob is a static string literal; `{ eager: true }` is **load-bearing** for SSG body inlining.
- **`hyperdownMdxPlugin`** wraps `@mdx-js/rollup` and intercepts `*.mdx?raw` (MDX strips the query before exclude filters run). **It MUST be listed before the framework plugins.**
- **`ContentRepository<T>` (`db/repository.ts`)**: `search()` (FTS5 MATCH + filters + sort + pagination — filters are exact-match or tag-bridge only, never LIKE), `distinctValues()` (facets), `getMetaBySlug()` (locale fallback). Exported only from **`@virtus/hyper-down/server`**. Codegen emits `builder.ts` with a lazy `<type>Repository` Proxy (deferred `new` — load-bearing for Rolldown chunk init order; keep `lazy-repository`'s ContentRepository import DYNAMIC).
- **`createContentResolver(modules)`** is the browser-safe view-layer counterpart → `getContent(slug, lang)`; render with `MdxRender`.
- **SSR SQLite (`db/client/ssr.ts`)**: `bun:sqlite`, or `node:sqlite` on Node ≥22 (e.g. Vercel); file-based, read-only, memoized opens. Prefers `dist/metadata/<name>.db` in production (gated to `NODE_ENV !== "development"`).
- The **Vite plugin (`hyperdownPlugin`)** runs codegen on `buildStart` (idempotent writes), spawns the writer (`bun` subprocess) per collection, and on `closeBundle` (**build only** — vitest boots Vite with a dummy outDir) copies every `.db` into `dist/metadata/`.
- **The writer is OOP-decomposed**: `HyperDownWriter` → `CollectionDbBuilder` (parallel read/parse/validate pool → serial single-transaction persist) → `CollectionSchema` (pure DDL).
- Next.js adapter: `@virtus/hyper-down/next` (`withHyperDown`, `runHyperDownNextCodegen`).

### HyperJson (`packages/HyperJson`)

- Validates JSON content against per-folder `schema.json` at build time (`hyperjsonValidationPlugin`).
- Codegen (`HyperJsonCodegen`): in-process `json-schema-to-typescript`, parallel pool (`HYPERJSON_CONCURRENCY`). Writes **only into the consuming app's `.hyper-json/`** — never into the installed package (its own `src/lib/types.ts` is dev-time codegen via `scripts/gen-types.ts`, prebuild).
- Provides `virtual:hyperjson-config` and headless hooks (`@virtus/hyper-json/hooks`).
- No dependency on frontmatter — all frontmatter logic lives in HyperDown.

### Scaffold (`packages/scaffold`)

- Templates overlay `_shared` + `<id>`. Tokens: `__PROJECT_NAME__`/`__TEMPLATE_ID__`, plus Markdown-safe `{{PROJECT_NAME}}`/`{{TEMPLATE_ID}}` for `.md` files (formatters mangle `__x__` into bold).
- Test script is pinned to `bun test __tests__/scaffold` — a bare `bun test` would also match `templates/_shared/__tests__/` (ships to generated apps).
- Harness `bun run test:templates`: packs both engines as tarballs, scaffolds each template, installs, builds, typechecks, runs unit + Playwright e2e.

### Type Generation (auto-generated — do not hand-edit)

- `packages/HyperDown/src/frontmatter/schema-types.ts`, `packages/{HyperDown,HyperJson}/types.d.ts`, `packages/HyperJson/src/lib/types.ts` — regen via each package's `bun run gen:types` (run after modifying any `schemas/` file).
- Consuming apps' `.hyper-down/**` and `.hyper-json/**` trees.
