import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as p from "@clack/prompts";
import { compileFromFile } from "json-schema-to-typescript";

import { BaseCommand } from "./base-command.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class UpdateCommand extends BaseCommand {
  private readonly schemas = [
    { name: "frontmatter", url: "https://frontmatter.codes/frontmatter.schema.json" },
    {
      name: "frontMatter.content.pageFolders",
      url: "https://frontmatter.codes/config/content.pagefolders.schema.json",
    },
    {
      name: "frontMatter.content.placeholders",
      url: "https://frontmatter.codes/config/content.placeholders.schema.json",
    },
    {
      name: "frontMatter.content.snippets",
      url: "https://frontmatter.codes/config/content.snippets.schema.json",
    },
    {
      name: "frontMatter.custom.scripts",
      url: "https://frontmatter.codes/config/custom.scripts.schema.json",
    },
    {
      name: "frontMatter.data.files",
      url: "https://frontmatter.codes/config/data.files.schema.json",
    },
    {
      name: "frontMatter.data.folders",
      url: "https://frontmatter.codes/config/data.folders.schema.json",
    },
    {
      name: "frontMatter.data.types",
      url: "https://frontmatter.codes/config/data.types.schema.json",
    },
    {
      name: "frontMatter.media.contentTypes",
      url: "https://frontmatter.codes/config/media.contenttypes.schema.json",
    },
    {
      name: "frontMatter.taxonomy.contentTypes",
      url: "https://frontmatter.codes/config/taxonomy.contenttypes.schema.json",
    },
    {
      name: "frontMatter.taxonomy.fieldGroups",
      url: "https://frontmatter.codes/config/taxonomy.fieldgroups.schema.json",
    },
  ];

  public async run(target: string | boolean, opts: { output?: string } = {}): Promise<void> {
    await this.executeSafely(async () => {
      const t = target === true ? "schemas" : target;

      if (t === "schemas") {
        await this.updateSchemas(opts.output);
      } else {
        p.log.error(`Unknown update target: ${t}`);
        process.exit(1);
      }
    });
  }

  private async updateSchemas(outputDir?: string): Promise<void> {
    const schemasDir = join(__dirname, "../../schemas");
    if (!existsSync(schemasDir)) {
      mkdirSync(schemasDir, { recursive: true });
    }

    const sp = p.spinner();
    sp.start("Downloading FrontMatter schemas…");

    for (const schema of this.schemas) {
      await this.downloadAndPatchSchema(schema, schemasDir);
    }

    sp.stop("Schemas downloaded");

    sp.start("Generating TypeScript interfaces…");
    const combinedTypes = await this.generateTypes(schemasDir);
    const typesPath = outputDir
      ? resolve(process.cwd(), outputDir)
      : join(__dirname, "../../src/frontmatter/schema-types.ts");
    writeFileSync(typesPath, combinedTypes);
    sp.stop("TypeScript interfaces generated");

    p.log.success(`Written to ${typesPath}`);
  }

  private async downloadAndPatchSchema(
    schema: { name: string; url: string },
    schemasDir: string,
  ): Promise<void> {
    try {
      const response = await fetch(schema.url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

      let data = await response.text();
      data = this.cleanSchemaData(data);

      const parsed = JSON.parse(data);
      this.patchLocalRefs(parsed);

      const fileName = schema.url.split("/").pop() || `${schema.name}.json`;
      writeFileSync(join(schemasDir, fileName), JSON.stringify(parsed, null, 2));
    } catch (err) {
      p.log.error(`Error processing ${schema.name}: ${(err as Error).message}`);
    }
  }

  private cleanSchemaData(data: string): string {
    let clean = data.replace(/"\$id"\s*:\s*"https:\/\/[^"]+"\s*,?/g, "");
    clean = clean.replace(/"\$id"\s*:\s*"#[^"]+"\s*,?/g, "");
    clean = clean.replace(/"https:\/\/frontmatter\.codes\/config\//g, '"');
    clean = clean.replace(/"https:\/\/frontmatter\.codes\//g, '"');
    return clean;
  }

  private patchLocalRefs(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = (obj as Record<string, unknown>)[key];
        if (val && typeof val === "object") {
          const castVal = val as Record<string, unknown>;
          if (castVal.$ref && typeof castVal.$ref === "string" && castVal.$ref.startsWith("#")) {
            if (castVal.$ref === "#i18n") {
              (obj as Record<string, unknown>)[key] = {
                type: "object",
                properties: {
                  title: { type: "string" },
                  locale: { type: "string" },
                  path: { type: "string" },
                },
              };
            } else {
              (obj as Record<string, unknown>)[key] = {
                type: "object",
                additionalProperties: true,
              };
            }
          } else {
            this.patchLocalRefs(val);
          }
        }
      }
    }
  }

  private async generateTypes(schemasDir: string): Promise<string> {
    // oxfmt-ignore
    let combinedTypes = "/* oxlint-disable */\n/* oxfmt-disable */\n/* eslint-disable */\n// @ts-nocheck\n\n";

    const generateType = async (filename: string, transform?: (ts: string) => string) => {
      const path = join(schemasDir, filename);
      if (!existsSync(path)) return;
      try {
        let ts = await compileFromFile(path, {
          bannerComment: "",
          cwd: schemasDir,
          declareExternallyReferenced: true,
        });
        if (transform) ts = transform(ts);
        combinedTypes += ts + "\n";
      } catch (err) {
        p.log.error(`Error generating types from ${filename}: ${(err as Error).message}`);
      }
    };

    await generateType("taxonomy.contenttypes.schema.json");
    await generateType("content.pagefolders.schema.json");
    await generateType("frontmatter.schema.json", (ts) =>
      ts.replace(/interface FrontMatterTeamSettings/, "interface FrontmatterConfig"),
    );

    return combinedTypes;
  }
}
