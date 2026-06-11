import { defineConfig } from "tsdown";

// ─── External dependencies shared across all entries ─────────────────────────
// Runtime dependencies that the consuming app provides via node_modules.
const sharedExternal = [
  "react",
  "react-dom",
  "pino",
  "pino-pretty",
  // Vite virtual modules — only resolved inside a Vite build context
  "virtual:hyperjson-config",
  // CLI runtime deps — used by `bin/hyperjson` commands
  "@clack/prompts",
  "ajv",
  "ajv-formats",
  "commander",
  "json-schema-to-typescript",
  "@modelcontextprotocol/sdk",
];

export default defineConfig([
  // ── Browser-safe entry ──────────────────────────────────────────────────────
  // React hooks for consuming JSON content in the browser (useFilter, useSearch,
  // usePaginate, useSort, useComposed). No node: imports here.
  {
    entry: { hooks: "src/hooks/index.ts" },
    platform: "browser",
    format: ["esm"],
    unbundle: true,
    dts: true,
    clean: true,
    deps: {
      neverBundle: [...sharedExternal],
    },
    // Schemas are copied once (here) to the dist root so the CLI and plugin
    // can locate them via `resolve(import.meta.dir, "../schemas/...")` at
    // runtime, regardless of which entry the consumer loads.
    copy: [{ from: "schemas/*", to: "dist/schemas" }],
  },

  // ── Node.js lib entry ───────────────────────────────────────────────────────
  // Config loading, validation, and codegen utilities.
  // Built as a single entry to avoid shared-chunk DTS naming collisions.
  {
    entry: { index: "src/lib/index.ts" },
    platform: "node",
    format: ["esm"],
    unbundle: true,
    fixedExtension: false,
    dts: true,
    clean: false,
    deps: {
      neverBundle: [...sharedExternal, "vite"],
    },
  },

  // ── Node.js plugins entry ───────────────────────────────────────────────────
  // Vite plugin only — separate entry to avoid DTS shared-chunk collisions
  // with the lib entry (both reference plugin types).
  {
    entry: { plugins: "src/plugins/index.ts" },
    platform: "node",
    format: ["esm"],
    unbundle: true,
    fixedExtension: false,
    dts: true,
    clean: false,
    deps: {
      neverBundle: [...sharedExternal, "vite"],
    },
  },

  // ── CLI entry ──────────────────────────────────────────────────────────────
  // Bundled CLI exposed via the `"bin"` field in package.json
  // (`hyperjson` → `./dist/bin/hyperjson.js`). Includes `validate`,
  // `generate`, and `init` subcommands; relies on the copied `schemas/`
  // folder for runtime schema resolution.
  //
  // The MCP server (`hyperjson-mcp`) wraps the same CLI as MCP tools.
  {
    entry: {
      "bin/hyperjson": "cli/hyperjson.ts",
      "bin/hyperjson-mcp": "mcp/server.ts",
    },
    platform: "node",
    format: ["esm"],
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: [...sharedExternal, "vite"],
    },
  },
]);
