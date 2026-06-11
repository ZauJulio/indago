# HyperJson · Agent Resources

Reference for AI agents operating `@virtus/hyper-json`. Independent of HyperDown — it owns
structured `.json` content; HyperDown owns Markdown. **Rules** are constraints; **skills**
are task recipes.

- [rules/architecture.md](rules/architecture.md) — validation, codegen, virtual config, hooks.
- [rules/configuration.md](rules/configuration.md) — `hyperjson.config.json` + `schema.json`.
- [rules/checks.md](rules/checks.md) — mandatory checks + do-not-edit files.
- [skills/cli.md](skills/cli.md) — CLI commands and when to run them.
- [skills/add-content-type.md](skills/add-content-type.md) — scaffold a new JSON type.
- [skills/change-schema.md](skills/change-schema.md) — evolve an existing schema safely.

## CLI / MCP

```bash
hyperjson init|validate|generate|create-content-type
```

In this monorepo: `bun cli/hyperjson.ts <cmd>` (or the `cli:*` scripts). The MCP server
(`hyperjson-mcp`, stdio) exposes: `hyperjson_init`, `hyperjson_validate`,
`hyperjson_generate`, `hyperjson_create_content_type`.
