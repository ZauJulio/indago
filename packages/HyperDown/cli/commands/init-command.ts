import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import * as p from "@clack/prompts";

import { BaseCommand } from "./base-command.ts";

export class InitCommand extends BaseCommand {
  private readonly schemaContent = JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Frontmatter Schema",
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        date: { type: "string", format: "date" },
      },
      required: ["title", "date"],
    },
    null,
    2,
  );

  private readonly configContent = JSON.stringify(
    {
      database: {
        contentDir: "src/content",
        frontmatterJsonPath: "frontmatter.json",
      },
      sitemap: {
        siteUrl: "https://example.com",
        outputPath: "./public/sitemap.xml",
        staticRoutes: [{ path: "/", priority: "1.0", changefreq: "weekly" }],
        contentTypes: [],
      },
      i18n: { defaultLocale: "en", locales: ["en"], strategy: "folder", filePattern: {} },
    },
    null,
    2,
  );

  public async run(target: string | boolean): Promise<void> {
    await this.executeSafely(() => {
      const cwd = process.cwd();
      const schemaPath = resolve(cwd, "frontmatter.schema.json");
      const configPath = resolve(cwd, "hyperdown.config.json");
      const t = target === true ? "both" : target;

      if (t === "frontmatter" || t === "both") {
        this.createFile(schemaPath, this.schemaContent, "frontmatter.schema.json");
      }

      if (t === "config" || t === "both") {
        this.createFile(configPath, this.configContent, "hyperdown.config.json");
      }
    });
  }

  private createFile(path: string, content: string, name: string): void {
    if (!existsSync(path)) {
      writeFileSync(path, content + "\n");
      p.log.success(`Created ${name}`);
    } else {
      p.log.warning(`${name} already exists`);
    }
  }
}
