import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as p from "@clack/prompts";

import { log } from "../../src/lib/logger.ts";
import { BaseCommand } from "./base-command.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SchemaProperty {
  type: string;
  items?: { type: string } | { $ref: string };
  enum?: string[];
  pattern?: string;
  format?: string;
}

interface SchemaDefinition {
  title: string;
  type: "object";
  required: string[];
  properties: Record<string, SchemaProperty>;
}

interface CreateContentTypeOptions {
  name?: string;
  title?: string;
  locales?: string;
  fields?: string;
  contentDir?: string;
  wrapper?: string;
}

// ─── Field type options for interactive mode ────────────────────────────────

const FIELD_TYPE_OPTIONS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "integer", label: "integer" },
  { value: "boolean", label: "boolean" },
  { value: "string[]", label: "string[] (array of strings)" },
  { value: "enum", label: "enum (string with choices)" },
  { value: "date", label: "date (string with YYYY-MM-DD pattern)" },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSchemaProperty(fieldType: string, enumValues?: string[]): SchemaProperty {
  switch (fieldType) {
    case "number":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "string[]":
      return { type: "array", items: { type: "string" } };
    case "enum":
      return { type: "string", enum: enumValues };
    case "date":
      return { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
    default:
      return { type: "string" };
  }
}

function buildSchema(
  schemaTitle: string,
  itemTitle: string,
  fields: { name: string; type: string; required: boolean; enumValues?: string[] }[],
  wrapperProp: string,
  additionalProperties: boolean,
): Record<string, unknown> {
  const properties: Record<string, SchemaProperty> = {};
  const requiredFields: string[] = [];

  for (const f of fields) {
    properties[f.name] = toSchemaProperty(f.type, f.enumValues);
    if (f.required) requiredFields.push(f.name);
  }

  const definition: SchemaDefinition = {
    title: itemTitle,
    type: "object",
    required: requiredFields,
    properties,
  };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: schemaTitle,
    type: "object",
    properties: {
      [wrapperProp]: {
        type: "array",
        items: { $ref: `#/definitions/${itemTitle}` },
      },
    },
    required: [wrapperProp],
    additionalProperties,
    definitions: { [itemTitle]: definition },
  };
}

function buildEmptyJson(wrapperProp: string): Record<string, unknown> {
  return { [wrapperProp]: [] };
}

// ─── Command ────────────────────────────────────────────────────────────────

export class CreateContentTypeCommand extends BaseCommand {
  public async run(opts: CreateContentTypeOptions = {}): Promise<void> {
    const isNonInteractive = Boolean(opts.name && opts.fields);

    if (isNonInteractive) {
      await this.runNonInteractive(opts);
    } else {
      await this.runInteractive(opts);
    }
  }

  private async runNonInteractive(opts: CreateContentTypeOptions): Promise<void> {
    const name = opts.name ?? "";
    const locales = opts.locales ? opts.locales.split(",").map((l) => l.trim()) : ["en"];
    const contentDir = opts.contentDir ?? "src/content";
    const wrapper = opts.wrapper ?? "items";
    const schemaTitle =
      opts.title ?? `${name.charAt(0).toUpperCase() + name.slice(1)}ContentSchema`;
    const itemTitle = `${name.charAt(0).toUpperCase() + name.slice(1)}Item`;

    const fields = (opts.fields ?? "").split(";").map((f) => {
      const [fieldName, type = "string", req] = f.trim().split(":");
      return { name: fieldName, type, required: req === "required" };
    });

    const schema = buildSchema(schemaTitle, itemTitle, fields, wrapper, false);
    const emptyData = buildEmptyJson(wrapper);

    const baseDir = resolve(process.cwd(), contentDir, name);
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "schema.json"), JSON.stringify(schema, null, 2) + "\n");

    for (const locale of locales) {
      const localeDir = join(baseDir, locale);
      mkdirSync(localeDir, { recursive: true });
      writeFileSync(join(localeDir, `${name}.json`), JSON.stringify(emptyData, null, 2) + "\n");
    }

    log.info(`✅ Created content type "${name}" at ${baseDir}`);
  }

  private async runInteractive(opts: CreateContentTypeOptions): Promise<void> {
    p.intro("📦 HyperJson — Create Content Type");

    const name = await p.text({
      message: "Content type name (folder name):",
      placeholder: "education",
      initialValue: opts.name,
      validate: (v) => (!v ? "Required" : undefined),
    });
    if (p.isCancel(name)) {
      p.cancel("Cancelled");
      return;
    }

    const schemaTitle = await p.text({
      message: "Schema title:",
      initialValue: `${String(name).charAt(0).toUpperCase() + String(name).slice(1)}ContentSchema`,
    });
    if (p.isCancel(schemaTitle)) {
      p.cancel("Cancelled");
      return;
    }

    const itemTitle = await p.text({
      message: "Item definition name:",
      initialValue: `${String(name).charAt(0).toUpperCase() + String(name).slice(1)}Item`,
    });
    if (p.isCancel(itemTitle)) {
      p.cancel("Cancelled");
      return;
    }

    const wrapper = await p.text({
      message: "Top-level array property name:",
      initialValue: opts.wrapper ?? "items",
    });
    if (p.isCancel(wrapper)) {
      p.cancel("Cancelled");
      return;
    }

    // Collect fields
    const fields: { name: string; type: string; required: boolean; enumValues?: string[] }[] = [];
    let addMore = true;

    while (addMore) {
      const fieldName = await p.text({
        message: "Field name:",
        placeholder: "id",
        validate: (v) => (!v ? "Required" : undefined),
      });
      if (p.isCancel(fieldName)) break;

      const fieldType = await p.select({
        message: `Type for "${String(fieldName)}":`,
        options: [...FIELD_TYPE_OPTIONS],
      });
      if (p.isCancel(fieldType)) break;

      let enumValues: string[] | undefined;
      if (fieldType === "enum") {
        const rawEnums = await p.text({
          message: "Enum values (comma-separated):",
          placeholder: "brand-500, brand-300",
        });
        if (!p.isCancel(rawEnums)) {
          enumValues = String(rawEnums)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        }
      }

      const required = await p.confirm({
        message: `Is "${String(fieldName)}" required?`,
        initialValue: true,
      });

      fields.push({
        name: String(fieldName),
        type: String(fieldType),
        required: !p.isCancel(required) && Boolean(required),
        enumValues,
      });

      const more = await p.confirm({ message: "Add another field?", initialValue: true });
      addMore = !p.isCancel(more) && Boolean(more);
    }

    // Locales
    const localesRaw = await p.text({
      message: "Locales (comma-separated):",
      placeholder: "en, pt-BR",
      initialValue: opts.locales ?? "en",
    });
    if (p.isCancel(localesRaw)) {
      p.cancel("Cancelled");
      return;
    }
    const locales = String(localesRaw)
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const additionalProps = await p.confirm({
      message: "Allow additional properties in the schema?",
      initialValue: false,
    });

    const contentDir = opts.contentDir ?? "src/content";
    const schema = buildSchema(
      String(schemaTitle),
      String(itemTitle),
      fields,
      String(wrapper),
      !p.isCancel(additionalProps) && Boolean(additionalProps),
    );

    const emptyData = buildEmptyJson(String(wrapper));

    const baseDir = resolve(process.cwd(), contentDir, String(name));
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "schema.json"), JSON.stringify(schema, null, 2) + "\n");

    for (const locale of locales) {
      const localeDir = join(baseDir, locale);
      mkdirSync(localeDir, { recursive: true });

      writeFileSync(
        join(localeDir, `${String(name)}.json`),
        JSON.stringify(emptyData, null, 2) + "\n",
      );
    }

    p.outro(
      `Created content type "${String(name)}" with ${fields.length} field(s) and ${locales.length} locale(s)`,
    );
  }
}
