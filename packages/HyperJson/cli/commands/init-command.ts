import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import * as p from "@clack/prompts";

import { BaseCommand } from "./base-command.ts";

const DEFAULT_CONFIG = JSON.stringify(
  {
    $schema: "./node_modules/@virtus/hyper-json/schemas/hyperjson.config.schema.json",
    contentDir: "src/content",
    validation: { strict: true, failOnError: true },
  },
  null,
  2,
);

export class InitCommand extends BaseCommand {
  public async run(): Promise<void> {
    await this.executeSafely(() => {
      const configPath = resolve(process.cwd(), "hyperjson.config.json");

      if (existsSync(configPath)) {
        p.log.warning("hyperjson.config.json already exists — skipping.");
        return;
      }

      writeFileSync(configPath, DEFAULT_CONFIG + "\n");
      p.log.success("Created hyperjson.config.json");
    });
  }
}
