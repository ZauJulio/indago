#!/usr/bin/env bun
/**
 * HyperDown MCP server (stdio transport).
 *
 * Exposes the `hyperdown` CLI as MCP tools so MCP-aware agents (Claude
 * Desktop, Continue, Cursor, …) can validate configs, scaffold content,
 * and run codegen without learning the CLI surface.
 *
 * Run via:  `npx --package @muttum/hyper-down hyperdown-mcp`  (registered through the package's `"bin"`).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

// Locate the CLI entry. Candidates, in priority order:
//   1. Sibling in dist/bin — the published/compiled layout, where this MCP
//      server (dist/bin/hyperdown-mcp.js) sits next to dist/bin/hyperdown.js.
//   2. Built CLI relative to the source mcp/ dir — when running from source
//      (bun mcp/server.ts) after a local build.
//   3. The CLI source — final fallback for an unbuilt source checkout.
const cliCandidates = [
  resolve(__dirname, "hyperdown.js"),
  resolve(__dirname, "../dist/bin/hyperdown.js"),
  resolve(__dirname, "../cli/hyperdown.ts"),
];
const CLI_PATH = cliCandidates.find((p) => existsSync(p)) ?? cliCandidates[0];
// Reuse the runtime already executing this MCP server (bun, per the bin
// shebang). bun runs both the compiled `.js` CLI and the `.ts` source fallback;
// the `.ts` fallback specifically requires bun.
const RUNTIME = process.execPath;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  args: (input: Record<string, unknown>) => string[];
}

const tools: ToolDef[] = [
  {
    name: "hyperdown_init",
    description:
      "Scaffold hyperdown.config.json or frontmatter.json in the current working directory.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["config", "frontmatter", "both"],
          description: "Which file(s) to scaffold.",
          default: "both",
        },
      },
    },
    args: (input) => ["init", String(input.target ?? "both")],
  },
  {
    name: "hyperdown_validate",
    description: "Validate hyperdown.config.json and/or frontmatter.json against bundled schemas.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["config", "frontmatter", "both"],
          default: "both",
        },
      },
    },
    args: (input) => ["validate", String(input.target ?? "both")],
  },
  {
    name: "hyperdown_update",
    description: "Re-run codegen against bundled HyperDown schemas.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["schemas"], default: "schemas" },
      },
    },
    args: (input) => ["update", String(input.target ?? "schemas")],
  },
  {
    name: "hyperdown_gen_db",
    description:
      "Generate the per-collection SQLite databases (codegen + frontmatter scan) from the project's hyperdown.config.json.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to hyperdown.config.json.",
          default: "./hyperdown.config.json",
        },
      },
    },
    args: (input) => ["gen:db", "--path", String(input.path ?? "./hyperdown.config.json")],
  },
  {
    name: "hyperdown_create_content",
    description:
      "Add a new content type to frontmatter.json (+ template and example item). All of `name`, `folder`, and `fields` are REQUIRED — interactive mode is disabled inside MCP. Fields format: comma-separated `name:type:req|opt` (types: string, number, boolean, datetime, draft, tags, categories, image, choice[a|b]).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Singular content type name (e.g. 'product')." },
        folder: { type: "string", description: "Plural folder title (e.g. 'Products')." },
        fields: {
          type: "string",
          description: "Comma-separated fields, e.g. 'title:string:req,tags:tags:opt'.",
        },
      },
      required: ["name", "folder", "fields"],
    },
    args: (input) => [
      "create-content",
      "--name",
      String(input.name),
      "--folder",
      String(input.folder),
      "--fields",
      String(input.fields),
    ],
  },
  {
    name: "hyperdown_create_frontmatter",
    description:
      "Create a frontmatter.json file with a default content type. Use --name to set the content type name and --locales for i18n codes.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Content type name (e.g. 'article')." },
        locales: {
          type: "string",
          description: "Comma-separated locale codes (e.g. 'en,pt-BR').",
          default: "en",
        },
      },
      required: ["name"],
    },
    args: (input) => [
      "create-frontmatter",
      "--name",
      String(input.name),
      "--locales",
      String(input.locales ?? "en"),
    ],
  },
  {
    name: "hyperdown_create_item",
    description:
      "Create a new content item (.mdx) of an existing content type. All three of `type`, `slug`, and `lang` are REQUIRED — interactive mode is disabled inside MCP.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Content type name from frontmatter.json (e.g. 'article').",
        },
        slug: { type: "string", description: "Filename slug (no extension)." },
        lang: { type: "string", description: "Locale code (e.g. 'en', 'pt-BR')." },
      },
      required: ["type", "slug", "lang"],
    },
    args: (input) => [
      "create-item",
      "--type",
      String(input.type),
      "--slug",
      String(input.slug),
      "--lang",
      String(input.lang),
    ],
  },
];

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolveP) => {
    const child = spawn(RUNTIME, [CLI_PATH, ...args], { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveP({ stdout, stderr, code: code ?? -1 }));
  });
}

/** Build the MCP server with both request handlers wired up. */
export function createServer(): Server {
  const server = new Server(
    { name: "hyperdown-mcp", version: pkg.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);

    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
      };
    }

    const input = (req.params.arguments ?? {}) as Record<string, unknown>;
    const { stdout, stderr, code } = await runCli(tool.args(input));

    return {
      isError: code !== 0,
      content: [
        {
          type: "text",
          text: `exit=${code}\n--- stdout ---\n${stdout || "(empty)"}\n--- stderr ---\n${stderr || "(empty)"}`,
        },
      ],
    };
  });

  return server;
}

// Exposed for tests; the tool registry + arg mapping is the meaningful surface.
export { tools, runCli };

// Only start the stdio transport when invoked as the binary entry point — not
// when imported (e.g. by tests), which would otherwise block on stdin.
if (import.meta.main) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
