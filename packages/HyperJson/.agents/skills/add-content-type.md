# Skill — Add a new content type

1. `hyperjson create-content-type --name projects --title Project --fields "id:string:required;name:string:required;url:string"`
   — flat fields are `name:type[:required]`, `;`-separated ([format](cli.md)).
   - **Nested / recursive** types (objects in objects, arrays of objects, trees): use
     `--fields-json '<FieldSpec[]>'`, or run with no field flags for the interactive builder.
     See [cli.md](cli.md).
2. Add data files: `<contentDir>/projects/<lang>/*.json`.
3. `hyperjson validate content`.
4. `hyperjson generate` — emits the ambient types.
5. Consume: `import data from "@content/projects/<lang>/file.json"` (typed), optionally
   through `@indago/hyper-json/hooks`.

`strict: true` ⇒ unknown properties **fail validation**; keep data and schema in sync.
Checks: [../rules/checks.md](../rules/checks.md).
