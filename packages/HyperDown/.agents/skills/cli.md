# HyperDown — CLI

Bin: `hyperdown` (installed) / `bun cli/hyperdown.ts <cmd>` (in-repo). Commands are
non-interactive when given flags; otherwise they prompt.

| Command              | Purpose                                                   | Key flags                                                 |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `init [target]`      | Scaffold configs (`config` / `frontmatter` / `both`).     | —                                                         |
| `validate [target]`  | Validate configs (`config` / `frontmatter` / `both`).     | `-p <path>`                                               |
| `update schemas`     | Re-download + regenerate FrontMatter CMS schemas.         | `-o <output>`                                             |
| `gen:db`             | Codegen `.hyper-down/**`, then write the per-type `.db`s. | `-p <path>` (default `./hyperdown.config.json`)           |
| `create-frontmatter` | Create `frontmatter.json` with content types + i18n.      | `--name`, `--locales en,pt-BR`, `--content-dir`, `-o`     |
| `create-content`     | Add a content type to an existing `frontmatter.json`.     | `--name`, `--folder`, `--fields` (see format below), `-p` |
| `create-item`        | Create a new `.mdx` item in the right folder/locale.      | `--type`, `--slug`, `--lang`, `-p`                        |

## `--fields` format (create-content)

Comma-separated `name:type:req|opt` — the `req|opt` suffix is **mandatory**; malformed
entries are silently dropped. Types: `string`, `number`, `boolean`, `datetime`, `draft`,
`tags`, `categories`, `image`, `choice[a|b]`.

```bash
hyperdown create-content --name product --folder Products \
  --fields "title:string:req,price:number:opt,tags:tags:opt,status:choice[draft|live]:req"
```

## Typical flows

- **Bootstrap**: `init both` → edit `frontmatter.json` → `gen:db`.
- **New item**: `create-item --type article --slug my-post --lang en` → write body → `gen:db`.
- **CI gate**: `validate both` (non-zero exit on any error).

`gen:db` runs the `.hyper-down/**` codegen itself, so it is self-sufficient on a fresh
checkout — no prior build needed.
