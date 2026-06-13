# AGENTS.md

Guidance for AI agents working in this repository. Detailed per-engine guidance lives in:

- **[packages/HyperDown/.agents/](./packages/HyperDown/.agents/)** — HyperDown rules + skills.
- **[packages/HyperJson/.agents/](./packages/HyperJson/.agents/)** — HyperJson rules + skills.

## Stack

TypeScript monorepo: **Bun** (package manager + runtime) · **Turbo** · **Vite 8**.
Linting/formatting via **OXC** (`oxlint` + `oxfmt`) — **not** Biome/ESLint/Prettier.
Library builds via **tsdown** (Rolldown).

- `packages/HyperDown` (`@indago/hyper-down`) — Markdown/MDX CMS: frontmatter parser,
  SQLite (FTS5 contentless) generation, Vite plugins, virtual modules, server-side
  `ContentRepository`, browser-safe MDX resolver, Next.js adapter. **SSR-only**.
- `packages/HyperJson` (`@indago/hyper-json`) — typed JSON content: schema validation +
  TypeScript codegen (parallel pool, `HYPERJSON_CONCURRENCY`) + headless hooks.
- `packages/scaffold` (`@indago/create-app`) — scaffolder CLI: 4 templates (vike /
  react-router / tanstack / next), same routes + e2e suite. Harness:
  `bun run test:templates`; examples: `bun run gen:examples` (→ `examples/`).
- `packages/configs` (`@repo/configs`) — shared tsconfig/oxlint/oxfmt/Tailwind/Vite presets.

## Mandatory checks after any code edit (run in order)

```bash
bun run check        # oxlint + oxfmt (auto-fix)
bun run typecheck    # TypeScript across the monorepo
bun run test         # all test suites
bun run build        # full build
```

Fix every error **and warning** before considering a task done.

## CLI / MCP quick reference

```bash
hyperdown init|validate|update|gen:db|create-content|create-frontmatter|create-item
hyperjson init|validate|generate|create-content-type
bun create @indago/app my-app
```

MCP stdio servers: `hyperdown-mcp`
(`hyperdown_init|validate|update|gen_db|create_content|create_frontmatter|create_item`) and
`hyperjson-mcp` (`hyperjson_init|validate|generate|create_content_type`). Creation tools
require their full flag set (interactive prompts are disabled under MCP).
