#!/usr/bin/env bun
import { Command } from "commander";

import pkg from "../package.json" with { type: "json" };
import { CreateContentTypeCommand } from "./commands/create-content-type-command.ts";
import { GenerateCommand } from "./commands/generate-command.ts";
import { InitCommand } from "./commands/init-command.ts";
import { ValidateCommand } from "./commands/validate-command.ts";

const program = new Command();

program
  .name("hyperjson")
  .description("HyperJson CLI for managing JSON content schemas and TypeScript types")
  .version(pkg.version);

program
  .command("init")
  .description("Scaffold a default hyperjson.config.json")
  .action(async () => new InitCommand().run());

program
  .command("validate [target]")
  .description("Validate config and/or content JSON (config | content | both)")
  .option("-p, --path <path>", "Path to the file/dir matching [target] (config or content)")
  .action(async (target = "both", opts) => new ValidateCommand().run(target, { path: opts.path }));

program
  .command("generate")
  .alias("gen")
  .description("Generate TypeScript types from JSON content schemas")
  .action(async () => new GenerateCommand().run());

program
  .command("create-content-type")
  .description(
    "Scaffold a new JSON content type (schema.json + i18n dirs). " +
      "Run with no --fields/--fields-json for an interactive builder that supports nesting and recursion.",
  )
  .option("--name <name>", "Content folder name")
  .option("--title <title>", "Schema title")
  .option("--locales <locales>", "Comma-separated locale codes")
  .option("--fields <fields>", "Semicolon-separated flat fields (name:type[:required])")
  .option(
    "--fields-json <json>",
    "Structured fields as JSON — supports nested objects, arrays, and recursive refs",
  )
  .option("--content-dir <dir>", "Content directory", "src/content")
  .option("--wrapper <prop>", "Top-level array property name", "items")
  .action(async (opts) => new CreateContentTypeCommand().run(opts));

program.parse(process.argv);
