# HyperDown — Configuration

Two files, both with bundled JSON Schemas under `schemas/`; `hyperdown validate` checks them.

## `hyperdown.config.json` (app root)

```jsonc
{
  "$schema": "./node_modules/@indago/hyper-down/schemas/hyperdown.config.schema.json",
  "database": {
    "contentDir": "./content", // where .mdx lives; also the .hyper-down/ output root
    "frontmatterJsonPath": "frontmatter.json", // relative to THIS config file
  },
  "sitemap": {
    "siteUrl": "https://example.com",
    "outputPath": "./public/sitemap.xml",
    "staticRoutes": [{ "path": "/", "priority": "1.0", "changefreq": "weekly" }],
    "contentTypes": [{ "name": "article", "basePath": "/articles", "priority": "0.7" }],
  },
  "i18n": { "defaultLocale": "en", "locales": ["en", "pt-BR"] },
}
```

## `frontmatter.json` (FrontMatter CMS format)

- `frontMatter.content.pageFolders[]` — `{ title, path, contentTypes: ["article"],
defaultLocale, locales }`. The first `contentTypes` entry (else `title.toLowerCase()`)
  names the SQLite table and the `content/<name>/` folder.
- `frontMatter.taxonomy.contentTypes[]` — `{ name, fields: [{ name, type, required }] }`.
  Storage: `draft` → INTEGER (no FTS) · `datetime` → TEXT (no FTS) · `tags`/`categories` →
  TEXT JSON array (flattened into FTS + `<table>_tags` bridge) · else TEXT (FTS-indexed).
- A `type: "draft"` field is a **publish gate** (field name is configurable). An item whose
  draft field is truthy (`draft: true`) is excluded from the DB index, the `import.meta.glob`
  body map (so its MD/MDX is **never compiled/bundled**), and the sitemap — the source file
  stays in the repo but the build has no trace of it. `draft: false`/absent ⇒ published.

Locale comes from the path (`content/<type>/<lang>/slug.mdx`); slug defaults to the
filename (override with a `slug` front-matter field).

Scaffold with `hyperdown init` (both files) or `hyperdown create-frontmatter`.
