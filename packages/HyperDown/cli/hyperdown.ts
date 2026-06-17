#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";

import pkg from "../package.json" with { type: "json" };
import { CreateContentCommand } from "./commands/create-content-command.ts";
import { CreateFrontmatterCommand } from "./commands/create-frontmatter-command.ts";
import { CreateItemCommand } from "./commands/create-item-command.ts";
import { InitCommand } from "./commands/init-command.ts";
import { UpdateCommand } from "./commands/update-command.ts";
import { ValidateCommand } from "./commands/validate-command.ts";

const program = new Command();

program
  .name("hyperdown")
  .description("HyperDown CLI for managing frontmatter and content types")
  .version(pkg.version);

program
  .command("init [target]")
  .description("Scaffold config files (config | frontmatter | both)")
  .action(async (target = "both") => new InitCommand().run(target));

program
  .command("validate [target]")
  .description("Validate config and/or frontmatter (config | frontmatter | both)")
  .option("-p, --path <path>", "Path to the file matching [target] (config or frontmatter)")
  .action(async (target = "both", opts) => new ValidateCommand().run(target, { path: opts.path }));

program
  .command("update [target]")
  .description("Download and regenerate FrontMatter CMS schemas")
  .option("-o, --output <path>", "Output path for generated schema-types.ts")
  .action(async (target = "schemas", opts) =>
    new UpdateCommand().run(target, { output: opts.output }),
  );

program
  .command("gen:db")
  .description("Generate SQLite databases from frontmatter content")
  .option("-p, --path <path>", "Path to hyperdown.config.json", "./hyperdown.config.json")
  .action(async (opts) => {
    const configPath = resolve(process.cwd(), opts.path);
    if (!existsSync(configPath)) {
      p.log.error(`Config not found: ${configPath}`);
      process.exit(1);
    }

    const sp = p.spinner();
    sp.start("Generating SQLite databases…");

    try {
      const hyperdownConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      const configDir = resolve(configPath, "..");

      // Codegen first (same order as the Vite plugin) — the writer skips any
      // collection whose generated `.hyper-down/**/types.ts` is missing.
      const { HyperDownCodegen } = await import("../src/frontmatter/codegen.ts");
      new HyperDownCodegen(configDir).generate();

      const { HyperDownWriter } = await import("../src/frontmatter/writer.ts");
      const fmPath = hyperdownConfig.database?.frontmatterJsonPath ?? "frontmatter.json";
      const frontmatterConfig = JSON.parse(readFileSync(resolve(configDir, fmPath), "utf-8"));
      const writer = new HyperDownWriter(
        frontmatterConfig,
        configDir,
        fmPath,
        hyperdownConfig.database?.contentDir,
        {
          index: hyperdownConfig.database?.index,
          indexByCollection: hyperdownConfig.database?.indexByCollection,
        },
      );
      await writer.writeDatabases();
      sp.stop("Databases generated successfully.");
    } catch (err: unknown) {
      sp.stop("Failed to generate databases.");
      p.log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("create-content")
  .description("Create a new content type in frontmatter.json")
  .option("--name <name>", "Content type name")
  .option("--folder <folder>", "Folder title")
  .option("--fields <fields>", "Comma-separated fields (name:type:req)")
  .option("-p, --path <path>", "Path to hyperdown.config.json", "./hyperdown.config.json")
  .action(async (opts) => new CreateContentCommand().run(opts));

program
  .command("create-frontmatter")
  .description("Create a frontmatter.json with content types and i18n")
  .option("--name <name>", "Content type name (non-interactive)")
  .option("--locales <locales>", "Comma-separated locale codes")
  .option("--content-dir <dir>", "Content directory path", "src/content")
  .option("-o, --output <path>", "Output file path", "frontmatter.json")
  .action(async (opts) => new CreateFrontmatterCommand().run(opts));

program
  .command("create-item")
  .description("Create a new .mdx content item")
  .option("--type <type>", "Content type name")
  .option("--slug <slug>", "Filename slug")
  .option("--lang <lang>", "Locale code")
  .option("-p, --path <path>", "Path to hyperdown.config.json", "./hyperdown.config.json")
  .action(async (opts) => new CreateItemCommand().run(opts));

program.parse(process.argv);
