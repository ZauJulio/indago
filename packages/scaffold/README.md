# create-muttum-app

Scaffold a backend-free, content-driven web app wired to the two **Muttum** engines:

- **[HyperDown](https://www.npmjs.com/package/@muttum/hyper-down)** — Markdown/MDX → a contentless
  SQLite **FTS5** index, queried **only on the server**. Powers full-text search over articles &
  recipes with no client database.
- **[HyperJson](https://www.npmjs.com/package/@muttum/hyper-json)** — JSON Schema → build-time
  validation + generated TypeScript types. Powers typed structured content (projects).

Pick from **four** frameworks — every template ships the **same routes**, so one app's knowledge
(and one e2e suite) carries across all of them.

## Usage

```bash
# interactive (prompts for directory + framework + package manager)
npm create muttum-app@latest
bunx  create-muttum-app
pnpm  create muttum-app

# non-interactive
bunx create-muttum-app my-app --vike
bunx create-muttum-app my-app --react-router
bunx create-muttum-app my-app --tanstack
bunx create-muttum-app my-app --next
```

### Flags

| Flag             | Framework                                           |
| ---------------- | --------------------------------------------------- |
| `--vike`         | Vike + vike-react + Hono (SSG + live SSR search)    |
| `--react-router` | React Router v7 framework mode (Vite + SSR loaders) |
| `--tanstack`     | TanStack Start (Vite + server functions)            |
| `--next`         | Next.js App Router (@next/mdx + node:sqlite)        |

Other options: `[dir]` (target directory), `--pm <bun\|npm\|pnpm\|yarn>`, `--no-install`.

## Standardized routes

Generated apps expose the identical route surface (default locale prefix-free, `pt-BR` under `/pt`):

| Route             | Engine    |
| ----------------- | --------- |
| `/`               | —         |
| `/articles`       | HyperDown |
| `/articles/:slug` | HyperDown |
| `/cooking`        | HyperDown |
| `/cooking/:slug`  | HyperDown |
| `/projects`       | HyperJson |
| `/pt/*`           | —         |

A shared Playwright suite (`e2e/`) and a unit test (`__tests__/content.test.ts`) ship in every
template and assert the same behavior, so all four are interchangeable from a testing standpoint.

## Framework matrix

| Capability  | Vike            | React Router       | TanStack Start   | Next.js                      |
| ----------- | --------------- | ------------------ | ---------------- | ---------------------------- |
| Bundler     | Vite            | Vite               | Vite             | Webpack                      |
| Server data | `+data` loaders | route `loader`     | `createServerFn` | Server Components            |
| MDX bodies  | Vite glob       | Vite glob          | Vite glob        | explicit `@next/mdx` imports |
| Prod server | Hono            | react-router-serve | srvx             | `next start`                 |

## Requirements

- **Bun** must be on `PATH` for builds — HyperDown's content writer runs as a `bun` subprocess.
- **Node ≥ 22** (or Bun) at runtime, for the built-in SQLite reader (`node:sqlite` / `bun:sqlite`).

## Authoring content

- **Articles / recipes** — drop an `.mdx` file under `content/article/<locale>/` or
  `content/recipe/<locale>/`; the filename is the slug. Rebuild to regenerate the SQLite index.
- **Projects** — edit `content/projects/<locale>/projects.json`, validated against
  `content/projects/schema.json` at build time.

## Development (this package)

```bash
bun run dev                       # run the CLI from source
bun run test                      # scaffold-tool unit tests (__tests__/)
bun scripts/test-templates.ts     # scaffold + build + typecheck + unit + e2e, all 4 templates
bun scripts/test-templates.ts next   # a single template
bun run gen:examples              # regenerate examples/<id>/ from the templates
```
