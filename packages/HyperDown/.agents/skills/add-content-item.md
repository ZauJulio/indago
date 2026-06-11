# Skill — Add a content item

1. `hyperdown create-item --type article --slug my-post --lang en`
   → creates `content/article/en/my-post.mdx` with template front-matter.
2. Fill the required front-matter fields and the MDX body.
3. `hyperdown validate frontmatter`.
4. `hyperdown gen:db` (or any Vite build — the plugin regenerates automatically).

The item then appears in listings (FTS search + facets) and at its detail route.
CLI reference: [cli.md](cli.md) · checks: [../rules/checks.md](../rules/checks.md).
