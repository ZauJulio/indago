#!/usr/bin/env bun
/**
 * HyperJson MCP server (stdio transport).
 *
 * Exposes the `hyperjson` CLI as MCP tools so MCP-aware agents can validate
 * JSON content, regenerate TypeScript types, and bootstrap config files.
 *
 * Run via:  `npx --package @muttum/hyper-json hyperjson-mcp`  (registered through the package's `"bin"`).
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
//      server (dist/bin/hyperjson-mcp.js) sits next to dist/bin/hyperjson.js.
//   2. Built CLI relative to the source mcp/ dir — when running from source
//      (bun mcp/server.ts) after a local build.
//   3. The CLI source — final fallback for an unbuilt source checkout.
const cliCandidates = [
  resolve(__dirname, "hyperjson.js"),
  resolve(__dirname, "../dist/bin/hyperjson.js"),
  resolve(__dirname, "../cli/hyperjson.ts"),
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
    name: "hyperjson_init",
    description: "Scaffold a default hyperjson.config.json in the current working directory.",
    inputSchema: { type: "object", properties: {} },
    args: () => ["init"],
  },
  {
    name: "hyperjson_validate",
    description:
      "Validate hyperjson.config.json and/or every JSON content file against its sibling schema.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["config", "content", "both"],
          default: "both",
          description: "Which validation phase to run.",
        },
      },
    },
    args: (input) => ["validate", String(input.target ?? "both")],
  },
  {
    name: "hyperjson_generate",
    description: "Regenerate TypeScript types and ambient module declarations from JSON schemas.",
    inputSchema: { type: "object", properties: {} },
    args: () => ["generate"],
  },
  {
    name: "hyperjson_create_content_type",
    description:
      "Scaffold a new JSON content type — creates schema.json and i18n data folders. Both --name and --fields are REQUIRED for non-interactive mode.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Content folder name (e.g. 'education')." },
        fields: {
          type: "string",
          description:
            "Semicolon-separated fields: name:type[:required] (e.g. 'id:string:required;skills:string[]').",
        },
        locales: { type: "string", description: "Comma-separated locale codes.", default: "en" },
        title: { type: "string", description: "Schema title override." },
      },
      required: ["name", "fields"],
    },
    args: (input) => {
      const a = [
        "create-content-type",
        "--name",
        String(input.name),
        "--fields",
        String(input.fields),
      ];
      if (input.locales) a.push("--locales", String(input.locales));
      if (input.title) a.push("--title", String(input.title));
      return a;
    },
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

const server = new Server(
  { name: "hyperjson-mcp", version: pkg.version },
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

const transport = new StdioServerTransport();
await server.connect(transport);
