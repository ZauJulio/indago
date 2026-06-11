# Skill — Add or change a content type / field

1. `hyperdown create-content --name recipe --folder Cooking --fields "title:string:req,cuisine:string:opt"`
   — fields are `name:type:req|opt`, comma-separated ([format](cli.md)) — or hand-edit
   `frontmatter.json` (`pageFolders` + `taxonomy.contentTypes`,
   [shape](../rules/configuration.md)).
2. `hyperdown validate frontmatter`.
3. `hyperdown gen:db` — refreshes `.hyper-down/**` codegen and rebuilds the `.db`s.
4. Wire consumers: loaders import the generated `<type>Repository`; views use
   `createContentResolver(contentModules[type])` + `MdxRender`.

Only if you changed `packages/HyperDown/schemas/`: run `bun run gen:types` first.
Checks: [../rules/checks.md](../rules/checks.md).
