# HyperDown — Checks & generated files

## Mandatory after editing package code (in order)

```bash
bun run check        # oxlint + oxfmt (OXC — not ESLint/Biome)
bun run typecheck    # tsc --noEmit
bun run test         # bun test
bun run build        # tsdown
```

Fix every error **and warning**. After editing anything in `schemas/`, run
`bun run gen:types` first.

## Auto-generated — never hand-edit

- `src/frontmatter/schema-types.ts`, `types.d.ts` (regen: `bun run gen:types`)
- the consuming app's `.hyper-down/**` — `<contentDir>/<type>/{types,builder,modules}.ts`
  and `default.ts` (regen: `hyperdown gen:db` or any Vite build)
