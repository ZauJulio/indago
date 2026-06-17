import { defineConfig } from "tsdown";

// ─── External dependencies shared across all entries ─────────────────────────
// Runtime dependencies that the consuming app provides via node_modules. Marking
// them external keeps the dist lean (no transitive deep dep tree in dist/) and
// avoids bundling them multiple times across entries.
const sharedExternal = [
  "mermaid",
  "react",
  "react-dom",
  "react-i18next",
  "yaml",
  "drizzle-orm",
  "bun:sqlite",
  "node:sqlite",
  // Vite virtual modules — only resolved inside a Vite build context
  "virtual:hyperdown-config",
  "virtual:hyperdown-collections",
  "virtual:hyperdown-frontmatter",
  // Logging libraries
  "pino",
  "pino-pretty",
  // CLI runtime deps — used by `bin/hyperdown` commands
  "@clack/prompts",
  "ajv",
  "ajv-formats",
  "commander",
  "json-schema-to-typescript",
  "@modelcontextprotocol/sdk",
];

// ─── Single Node.js entry set ────────────────────────────────────────────────
// HyperDown is SSR-only: SQLite is queried exclusively on the server, so there
// is no browser-specific client, no `"browser"` export condition, and no OPFS
// Web Worker entry. The SSR client reaches Node built-ins only through dynamic
// `import()` inside its methods, so the static import graph stays browser-safe
// and a client bundle that transitively imports the package tree-shakes the
// server-only code away.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
    types: "src/db/types.ts",
    plugins: "src/plugins/index.ts",
    next: "src/plugins/next.ts",
    drizzle: "src/drizzle/index.ts",
    "bin/hyperdown": "cli/hyperdown.ts",
    "bin/hyperdown-mcp": "mcp/server.ts",
    // Spawned at runtime by the Vite plugin via `bun <writerScriptPath> <config>`.
    // Must be an explicit entry so it lands in dist with `unbundle: true`.
    "src/frontmatter/writer": "src/frontmatter/writer.ts",
  },
  platform: "node",
  format: ["esm"],
  unbundle: true,
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    neverBundle: [...sharedExternal, "vite", "vitest"],
  },
  copy: [
    { from: "schemas/*", to: "dist/schemas" },
    // `to` is a directory — the file lands at `dist/sidebar.css`.
    { from: "src/components/sidebar.css", to: "dist" },
  ],
});
