# HyperDown — Configuration

Two files, both with bundled JSON Schemas under `schemas/`; `hyperdown validate` checks them.

## `hyperdown.config.json` (app root)

```jsonc
{
  "$schema": "./node_modules/@virtus/hyper-down/schemas/hyperdown.config.schema.json",
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

Locale comes from the path (`content/<type>/<lang>/slug.mdx`); slug defaults to the
filename (override with a `slug` front-matter field).

Scaffold with `hyperdown init` (both files) or `hyperdown create-frontmatter`.
