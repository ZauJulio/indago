# Virtus — Local Headless CMS Toolkit

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-1-000000?logo=bun&logoColor=white" />
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
</p>

Two **zero-backend** content engines plus a scaffolder. They turn a folder of content files
into a typed, searchable content layer that ships as static assets — no database service,
no API. Each engine exposes a **Vite plugin**, a **CLI**, and an **MCP server**, and bundles
its JSON Schemas alongside the dist for runtime validation.

| Package                                      | npm                  | What it is                                                                                                           |
| -------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`packages/HyperDown`](./packages/HyperDown) | `@virtus/hyper-down` | Markdown/MDX → SQLite (FTS5 contentless) → server-side loaders. SSR-only, queried with `bun:sqlite` / `node:sqlite`. |
| [`packages/HyperJson`](./packages/HyperJson) | `@virtus/hyper-json` | JSON Schema → strict validation + generated TypeScript types + ambient module declarations for typed JSON imports.   |
| [`packages/scaffold`](./packages/scaffold)   | `create-virtus-app`  | Scaffolder CLI — 4 templates (Vike, React Router v7, TanStack Start, Next.js), same routes + e2e suite in each.      |
| [`packages/configs`](./packages/configs)     | —                    | Shared internal tooling config (tsconfig base, oxlint/oxfmt, Tailwind, Vite presets).                                |

> **The two engines are independent** — neither depends on the other. HyperDown owns
> Markdown/front-matter; HyperJson owns structured JSON. The reference consumer is the
> [portifolio](https://github.com/ZauJulio/portifolio) app ([zaujulio.vercel.app](https://zaujulio.vercel.app)).

## How it fits together

```text
content files                build time                          runtime
─────────────                ──────────                          ───────
content/<type>/<lang>/*.mdx  ──HyperDown──▶  per-type SQLite (.db)        ──▶  bun:sqlite / node:sqlite
              (front-matter)  contentless FTS5 index                           in server route loaders (SSR)
                              + .hyper-down/ codegen (builder/modules)         + lazy MDX via @hyper-down map

content/<type>/*.json        ──HyperJson──▶  Ajv validation                    typed @content/**.json imports
              (schema.json)   generated TS types + ambient d.ts                + headless filter/sort/search hooks
```

## Quick start (consumers)

```bash
bun create virtus-app my-app          # interactive
bunx create-virtus-app my-app --vike  # non-interactive (--react-router | --tanstack | --next)
```

Generated reference apps live in [`examples/`](./examples) — regenerate with
`bun run gen:examples`.

## Development (this repo)

> Requires **Bun** (the package manager is pinned to `bun@1.3.5`).

```bash
bun install

bun run build            # turbo run build (all packages)
bun run typecheck        # turbo run typecheck
bun run test             # turbo run test (bun test in each package)
bun run check            # oxlint + oxfmt across the repo
bun run test:templates   # full scaffold harness: 4 templates × (build + typecheck + unit + e2e)
```

Tooling is **OXC** (`oxlint` + `oxfmt`) — not ESLint, Prettier, or Biome. Library builds use
[tsdown](https://tsdown.dev/) (Rolldown-powered). Each engine ships a `.agents/` reference
tree for AI agents.

## License

[MIT](./LICENSE) © Zaú Júlio
