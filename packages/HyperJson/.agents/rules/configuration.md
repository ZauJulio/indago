# HyperJson — Configuration

## `hyperjson.config.json` (app root)

```jsonc
{
  "$schema": "./node_modules/@indago/hyper-json/schemas/hyperjson.config.schema.json",
  "contentDir": "content", // base dir for JSON content (the only required field)
  "validation": {
    "strict": true, // reject properties absent from the schema (default true)
    "failOnError": true, // non-zero exit on any validation error (default true)
  },
}
```

## Content folder layout

```text
<contentDir>/<type>/
  schema.json        JSON Schema (Draft-07); its `title` names the generated interface
  <lang>/*.json      data files (or flat *.json when not localized)
```

A top-level wrapper array property (default `items`) can hold the records —
`create-content-type --wrapper <prop>` sets it. Scaffold with `hyperjson init` +
`hyperjson create-content-type`.
