import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as p from "@clack/prompts";

import { log } from "../../src/utils/logger.server.ts";
import { BaseCommand } from "./base-command.ts";

interface ContentTypeField {
  title: string;
  name: string;
  type: string;
  default?: string;
  isPublishDate?: boolean;
  choices?: string[];
}

interface ContentTypeDef {
  name: string;
  fields: ContentTypeField[];
}

interface I18nLocale {
  title: string;
  locale: string;
  path: string;
}

interface CreateFrontmatterOptions {
  name?: string;
  locales?: string;
  contentDir?: string;
  output?: string;
}

const FIELD_TYPES = [
  { value: "string", label: "string" },
  { value: "datetime", label: "datetime" },
  { value: "draft", label: "draft (boolean)" },
  { value: "tags", label: "tags (string[])" },
  { value: "categories", label: "categories (string[])" },
  { value: "image", label: "image (path)" },
  { value: "choice", label: "choice (enum)" },
];

function parseLocalesFlag(raw: string): I18nLocale[] {
  return raw.split(",").map((l) => {
    const locale = l.trim();
    return { title: locale, locale, path: locale };
  });
}

function buildFrontmatterJson(
  contentTypes: ContentTypeDef[],
  locales: I18nLocale[],
  contentDir: string,
) {
  const pageFolders = contentTypes.map((ct) => ({
    title: ct.name.charAt(0).toUpperCase() + ct.name.slice(1),
    path: `[[workspace]]/${contentDir}/${ct.name}`,
    filePrefix: "",
    contentTypes: [ct.name],
    defaultLocale: locales[0]?.locale ?? "en",
    locales,
  }));

  return {
    $schema: "https://frontmatter.codes/frontmatter.schema.json",
    "frontMatter.taxonomy.contentTypes": contentTypes.map((ct) => ({
      name: ct.name,
      pageBundle: false,
      previewPath: null,
      fields: ct.fields,
    })),
    "frontMatter.framework.id": "other",
    "frontMatter.content.publicFolder": "",
    "frontMatter.content.i18n": locales,
    "frontMatter.content.pageFolders": pageFolders,
    "frontMatter.git.enabled": true,
  };
}

async function collectFieldsInteractively(): Promise<ContentTypeField[]> {
  const fields: ContentTypeField[] = [];

  let addMore = true;
  while (addMore) {
    const name = await p.text({
      message: "Field name:",
      placeholder: "title",
      validate: (v) => (!v ? "Required" : undefined),
    });
    if (p.isCancel(name)) return fields;

    const typeChoice = await p.select({
      message: `Type for "${String(name)}":`,
      options: FIELD_TYPES,
    });
    if (p.isCancel(typeChoice)) return fields;

    const field: ContentTypeField = {
      title: String(name).charAt(0).toUpperCase() + String(name).slice(1),
      name: String(name),
      type: String(typeChoice),
    };

    if (typeChoice === "datetime") {
      const isPublishDate = await p.confirm({
        message: "Is this the publish date?",
        initialValue: String(name) === "date",
      });
      if (!p.isCancel(isPublishDate) && isPublishDate) {
        field.isPublishDate = true;
        field.default = "{{now}}";
      }
    }

    if (typeChoice === "choice") {
      const choicesRaw = await p.text({
        message: "Choices (comma-separated):",
        placeholder: "easy, medium, hard",
      });
      if (!p.isCancel(choicesRaw)) {
        field.choices = String(choicesRaw)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
      }
    }

    fields.push(field);

    const more = await p.confirm({
      message: "Add another field?",
      initialValue: true,
    });
    addMore = !p.isCancel(more) && Boolean(more);
  }

  return fields;
}

export class CreateFrontmatterCommand extends BaseCommand {
  public async run(opts: CreateFrontmatterOptions = {}): Promise<void> {
    const outputPath = resolve(process.cwd(), opts.output ?? "frontmatter.json");

    if (existsSync(outputPath)) {
      log.warn(`⚠️ ${opts.output ?? "frontmatter.json"} already exists`);
      return;
    }

    const isNonInteractive = Boolean(opts.name);

    if (isNonInteractive) {
      await this.runNonInteractive(opts, outputPath);
    } else {
      await this.runInteractive(opts, outputPath);
    }
  }

  private async runNonInteractive(
    opts: CreateFrontmatterOptions,
    outputPath: string,
  ): Promise<void> {
    const locales = opts.locales
      ? parseLocalesFlag(opts.locales)
      : [{ title: "English", locale: "en", path: "en" }];
    const contentDir = opts.contentDir ?? "src/content";

    const ct: ContentTypeDef = {
      name: opts.name ?? "",
      fields: [
        { title: "Title", name: "title", type: "string" },
        { title: "Description", name: "description", type: "string" },
        {
          title: "Publishing date",
          name: "date",
          type: "datetime",
          default: "{{now}}",
          isPublishDate: true,
        },
        { title: "Is in draft", name: "draft", type: "draft" },
        { title: "Tags", name: "tags", type: "tags" },
      ],
    };

    const json = buildFrontmatterJson([ct], locales, contentDir);
    writeFileSync(outputPath, JSON.stringify(json, null, 2) + "\n");

    // Create locale directories
    for (const locale of locales) {
      const dir = join(process.cwd(), contentDir, ct.name, locale.path);
      mkdirSync(dir, { recursive: true });
    }

    log.info(`✅ Created ${outputPath}`);
  }

  private async runInteractive(opts: CreateFrontmatterOptions, outputPath: string): Promise<void> {
    p.intro("📝 HyperDown Frontmatter Creator");

    const contentTypes: ContentTypeDef[] = [];
    let addMoreTypes = true;

    while (addMoreTypes) {
      const name = await p.text({
        message: "Content type name:",
        placeholder: "article",
        validate: (v) => (!v ? "Required" : undefined),
      });
      if (p.isCancel(name)) {
        p.cancel("Operation cancelled");
        return;
      }

      p.log.info(`Adding fields for "${String(name)}"…`);
      const fields = await collectFieldsInteractively();
      contentTypes.push({ name: String(name), fields });

      const more = await p.confirm({
        message: "Add another content type?",
        initialValue: false,
      });
      addMoreTypes = !p.isCancel(more) && Boolean(more);
    }

    const localesRaw = await p.text({
      message: "Locales (comma-separated):",
      placeholder: "en, pt-BR",
      initialValue: "en",
    });
    if (p.isCancel(localesRaw)) {
      p.cancel("Operation cancelled");
      return;
    }

    const locales = parseLocalesFlag(String(localesRaw));
    const contentDir = opts.contentDir ?? "src/content";
    const json = buildFrontmatterJson(contentTypes, locales, contentDir);

    writeFileSync(outputPath, JSON.stringify(json, null, 2) + "\n");

    // Create locale directories for each content type
    for (const ct of contentTypes) {
      for (const locale of locales) {
        const dir = join(process.cwd(), contentDir, ct.name, locale.path);
        mkdirSync(dir, { recursive: true });
      }
    }

    p.outro(`✨ Created ${outputPath} with ${contentTypes.length} content type(s)`);
  }
}
