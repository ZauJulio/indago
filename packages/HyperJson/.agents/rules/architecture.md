# HyperJson — Architecture (invariants)

JSON Schema → strict Ajv validation + generated TypeScript types → typed JSON imports +
headless data hooks. No database, no backend; everything resolves to static imports.

1. **Validation** (`src/lib/validate.ts`, Ajv + ajv-formats): every content folder's
   `.json` is checked against its sibling `schema.json`. `strict` rejects unknown
   properties; `failOnError` exits non-zero. Build-time gate:
   `hyperjsonValidationPlugin` (`@indago/hyper-json/plugins`).
2. **Codegen** (`HyperJsonCodegen`, `src/codegen.ts`): compiles each schema with the
   in-process `json-schema-to-typescript` API through a bounded parallel pool
   (`HYPERJSON_CONCURRENCY`), emitting per-type ambient `declare module` types under the
   app's `.hyper-json/` plus a `generated.d.ts` barrel — so
   `import data from "@content/<type>/<file>.json"` is fully typed. It only writes into
   the **consuming app**, never into the installed package.
3. **Virtual config**: the plugin serves `virtual:hyperjson-config` (resolved
   `contentDir` + validation options) to Vite consumers.

## Hooks (`@indago/hyper-json/hooks`)

Pure in-memory React hooks over imported JSON arrays — no I/O: `useFilter`, `useSort`,
`useSearch`, `usePaginate`, `useComposed`.

## Exports

`.` (barrel) · `./hooks` · `./plugins`.
