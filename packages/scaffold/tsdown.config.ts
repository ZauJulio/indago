import { defineConfig } from "tsdown";

// Single bundled CLI entry exposed via the `"bin"` field
// (`create-muttum-app` → `./dist/index.js`). The `templates/` tree ships as
// static files (see package.json `"files"`) and is resolved at runtime
// relative to `import.meta.url`, so it is never bundled.
export default defineConfig({
  entry: { index: "src/index.ts" },
  platform: "node",
  format: ["esm"],
  dts: false,
  clean: true,
  deps: {
    neverBundle: ["@clack/prompts", "commander"],
  },
});
