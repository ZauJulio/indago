# vike

Generated with [`create-virtus-app`](https://www.npmjs.com/package/create-virtus-app) using the `vike` template. It wires two independent, backend-free content engines:

- **[HyperDown](https://www.npmjs.com/package/@virtus/hyper-down)** — Markdown/MDX → a contentless
  SQLite **FTS5** index, queried **only on the server** inside route loaders. Powers `/articles`
  and `/cooking`.
- **[HyperJson](https://www.npmjs.com/package/@virtus/hyper-json)** — JSON Schema → build-time
  validation + generated TypeScript types. Powers `/projects`.

## Routes

The same routes ship in every `create-virtus-app` template:

| Route             | Engine    | What it shows                                   |
| ----------------- | --------- | ----------------------------------------------- |
| `/`               | —         | Home with links to each section                 |
| `/articles`       | HyperDown | Full-text searchable article listing (`?q=`)    |
| `/articles/:slug` | HyperDown | Article detail (MDX body)                       |
| `/cooking`        | HyperDown | Recipe listing                                  |
| `/cooking/:slug`  | HyperDown | Recipe detail (MDX body)                        |
| `/projects`       | HyperJson | Schema-validated project list                   |
| `/pt/*`           | —         | Brazilian-Portuguese locale (en is prefix-free) |

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build (runs the engines' codegen)
npm run start      # serve the production build
npm run test       # unit tests (content integrity)
npm run test:e2e   # Playwright end-to-end tests
```

## Authoring content

- **Articles / recipes** — add an `.mdx` file under `content/article/<locale>/` or
  `content/recipe/<locale>/` with the frontmatter shown in `frontmatter.json`. The slug is the
  filename. The build regenerates the SQLite index.
- **Projects** — edit `content/projects/<locale>/projects.json`; it is validated against
  `content/projects/schema.json` at build time.

## Docker

```bash
docker compose up --build
```
