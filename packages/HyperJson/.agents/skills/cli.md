# HyperJson — CLI

Bin: `hyperjson` (installed) / `bun cli/hyperjson.ts <cmd>` (in-repo).

| Command                  | Purpose                                           | Key flags                                                 |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| `init`                   | Scaffold a default `hyperjson.config.json`.       | —                                                         |
| `validate [target]`      | Validate `config` / `content` / `both`.           | `-p <path>`                                               |
| `generate` (alias `gen`) | Generate TS types + ambient modules from schemas. | —                                                         |
| `create-content-type`    | Scaffold a type (`schema.json` + locale dirs).    | `--name`, `--title`, `--locales`, `--fields`, `--wrapper` |

## `--fields` format (create-content-type)

Semicolon-separated `name:type[:required]` — append `:required` literally to make a field
required (anything else means optional). Types: `string`, `number`, `boolean`, `string[]`.

```bash
hyperjson create-content-type --name projects --title Project \
  --fields "id:string:required;name:string:required;url:string;skills:string[]"
```

## Typical flows

- **Bootstrap**: `init` → `create-content-type` per type → `generate`.
- **Editing data**: edit `.json` → `validate content` (catches schema drift).
- **After a schema change**: `generate` to refresh types.
- **CI gate**: `validate both` (non-zero exit on any error).
