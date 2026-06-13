# HyperDown · Agent Resources

Reference for AI agents operating `@indago/hyper-down`. **Rules** are constraints;
**skills** are task recipes.

- [rules/architecture.md](rules/architecture.md) — pipeline, SSR runtime, plugins, exports.
- [rules/configuration.md](rules/configuration.md) — `hyperdown.config.json` + `frontmatter.json`.
- [rules/checks.md](rules/checks.md) — mandatory checks + do-not-edit files.
- [skills/cli.md](skills/cli.md) — CLI commands and when to run them.
- [skills/add-content-item.md](skills/add-content-item.md) — add an `.mdx` item.
- [skills/manage-content-types.md](skills/manage-content-types.md) — add/change a content type.

## CLI / MCP

```bash
hyperdown init|validate|update|gen:db|create-content|create-frontmatter|create-item
```

In this monorepo: `bun cli/hyperdown.ts <cmd>` (or the `cli:*` scripts). The MCP server
(`hyperdown-mcp`, stdio) exposes: `hyperdown_init`, `hyperdown_validate`, `hyperdown_update`,
`hyperdown_gen_db`, `hyperdown_create_content`, `hyperdown_create_frontmatter`,
`hyperdown_create_item`.
