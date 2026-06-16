# HyperJson — CLI

Bin: `hyperjson` (installed) / `bun cli/hyperjson.ts <cmd>` (in-repo).

| Command                  | Purpose                                           | Key flags                                                                  |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `init`                   | Scaffold a default `hyperjson.config.json`.       | —                                                                          |
| `validate [target]`      | Validate `config` / `content` / `both`.           | `-p <path>`                                                                |
| `generate` (alias `gen`) | Generate TS types + ambient modules from schemas. | —                                                                          |
| `create-content-type`    | Scaffold a type (`schema.json` + locale dirs).    | `--name`, `--title`, `--locales`, `--fields`, `--fields-json`, `--wrapper` |

Run `create-content-type` with **no** `--fields`/`--fields-json` to launch an interactive
builder that supports nesting and recursion (requires a TTY).

## `--fields` format (flat)

Semicolon-separated `name:type[:required]` — append `:required` literally to make a field
required (anything else means optional). Types: `string`, `number`, `integer`, `boolean`,
`date`, `enum`, `string[]`.

```bash
hyperjson create-content-type --name projects --title Project \
  --fields "id:string:required;name:string:required;url:string;skills:string[]"
```

## `--fields-json` format (nested / recursive)

A JSON array of `FieldSpec` for objects-within-objects, arrays of objects, and recursion.
A `FieldSpec` is `{ name, type, required?, enumValues?, format?, fields?, items?, def?, ref? }`:

- `type: "object"` → nested `fields`. Add `def: "Name"` to hoist it into `definitions` so it
  (or a sibling) can be referenced — this is how you build recursion.
- `type: "array"` → `items` is the element `FieldSpec` (its `name` is ignored).
- `type: "ref"` → `ref` names a definition to reuse (e.g. the item title, for a tree).

```bash
# A recursive menu: each item has children of the same type.
hyperjson create-content-type --name menu --wrapper items \
  --fields-json '[
    {"name":"label","type":"string","required":true},
    {"name":"children","type":"array","items":{"name":"","type":"ref","ref":"MenuItem"}}
  ]'
```

## Typical flows

- **Bootstrap**: `init` → `create-content-type` per type → `generate`.
- **Editing data**: edit `.json` → `validate content` (catches schema drift).
- **After a schema change**: `generate` to refresh types.
- **CI gate**: `validate both` (non-zero exit on any error).
