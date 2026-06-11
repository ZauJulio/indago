# HyperJson — Checks & generated files

## Mandatory after editing package code (in order)

```bash
bun run check        # oxlint + oxfmt (OXC — not ESLint/Biome)
bun run typecheck    # tsc --noEmit
bun run test         # bun test
bun run build        # tsdown
```

Fix every error **and warning**.

## Auto-generated — never hand-edit

- `types.d.ts` and `src/lib/types.ts` (regen: `bun run gen:types`, runs on prebuild)
- the consuming app's `.hyper-json/**` — per-type `types.ts` + `generated.d.ts`
  (regen: `hyperjson generate` or any Vite build)
