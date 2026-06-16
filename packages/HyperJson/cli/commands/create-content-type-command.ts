import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as p from "@clack/prompts";

import { log } from "../../src/lib/logger.ts";
import { BaseCommand } from "./base-command.ts";
import {
  buildContentSchema,
  buildEmptyData,
  type FieldSpec,
  type FieldType,
  parseFieldsJson,
  parseFlatFields,
  type SchemaConfig,
} from "./schema-builder.ts";

// ─── Options ──────────────────────────────────────────────────────────────────

interface CreateContentTypeOptions {
  name?: string;
  title?: string;
  locales?: string;
  fields?: string;
  fieldsJson?: string;
  contentDir?: string;
  wrapper?: string;
}

// ─── Interactive prompt options ───────────────────────────────────────────────

const CANCEL = Symbol("cancel");

const PRIMITIVE_OPTIONS = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "integer", label: "integer" },
  { value: "boolean", label: "boolean" },
  { value: "date", label: "date (string, YYYY-MM-DD)" },
  { value: "enum", label: "enum (string with choices)" },
] as const;

const FIELD_TYPE_OPTIONS = [
  ...PRIMITIVE_OPTIONS,
  { value: "string[]", label: "string[] (array of strings)" },
  { value: "object", label: "object (nested fields)" },
  { value: "array", label: "array (of a chosen element type)" },
  { value: "ref", label: "ref (reuse/recurse a named object)" },
] as const;

const STRING_FORMAT_OPTIONS = [
  { value: "", label: "none" },
  { value: "uri", label: "uri" },
  { value: "email", label: "email" },
  { value: "uuid", label: "uuid" },
  { value: "date-time", label: "date-time" },
] as const;

// ─── Interactive helpers ──────────────────────────────────────────────────────

function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) throw CANCEL;
  return value as T;
}

async function promptEnumValues(): Promise<string[]> {
  const raw = unwrap(
    await p.text({
      message: "Enum values (comma-separated):",
      placeholder: "draft, published, archived",
    }),
  );
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function promptDefName(label: string): Promise<string | undefined> {
  const raw = unwrap(
    await p.text({
      message: `Reusable definition name for ${label}? (blank = inline; name it to allow recursion)`,
      placeholder: "",
    }),
  );
  const name = String(raw).trim();
  return name || undefined;
}

/** Prompt the element spec for an `array` (or, recursively, an array of objects). */
async function promptArrayElement(label: string, defined: string[]): Promise<FieldSpec> {
  const elementType = unwrap(
    await p.select({
      message: `Element type for ${label}:`,
      options: [
        ...PRIMITIVE_OPTIONS,
        { value: "object", label: "object (nested fields)" },
        { value: "ref", label: "ref (named object)" },
      ],
    }),
  ) as FieldType;

  const item: FieldSpec = { name: "", type: elementType };

  if (elementType === "enum") {
    item.enumValues = await promptEnumValues();
  } else if (elementType === "object") {
    const def = await promptDefName(`${label} element`);
    if (def) {
      item.def = def;
      defined.push(def);
    }
    item.fields = await promptFields(label, defined);
  } else if (elementType === "ref") {
    item.ref = await promptRefTarget(defined);
  }

  return item;
}

async function promptRefTarget(defined: string[]): Promise<string> {
  return unwrap(
    await p.select({
      message: "Reference which definition?",
      options: defined.map((name) => ({ value: name, label: name })),
    }),
  ) as string;
}

/** Recursively collect the fields of one object (the item, a nested object, …). */
async function promptFields(label: string, defined: string[]): Promise<FieldSpec[]> {
  const fields: FieldSpec[] = [];

  for (;;) {
    const rawName = unwrap(
      await p.text({
        message: `${label} · field name (leave blank to finish):`,
        placeholder: fields.length === 0 ? "id" : "",
      }),
    );
    const name = String(rawName).trim();
    if (!name) break;

    const type = unwrap(
      await p.select({ message: `Type for "${name}":`, options: [...FIELD_TYPE_OPTIONS] }),
    ) as string;

    const spec: FieldSpec = { name, type: type as FieldType };

    if (type === "enum") {
      spec.enumValues = await promptEnumValues();
    } else if (type === "string") {
      const format = String(
        unwrap(
          await p.select({ message: `Format for "${name}":`, options: [...STRING_FORMAT_OPTIONS] }),
        ),
      );
      if (format) spec.format = format;
    } else if (type === "string[]") {
      spec.type = "array";
      spec.items = { name: "", type: "string" };
    } else if (type === "object") {
      const def = await promptDefName(`"${name}"`);
      if (def) {
        spec.def = def;
        defined.push(def);
      }
      spec.fields = await promptFields(`${label}.${name}`, defined);
    } else if (type === "array") {
      spec.items = await promptArrayElement(`"${name}[]"`, defined);
    } else if (type === "ref") {
      spec.ref = await promptRefTarget(defined);
    }

    spec.required = Boolean(
      unwrap(await p.confirm({ message: `Is "${name}" required?`, initialValue: true })),
    );
    fields.push(spec);
  }

  return fields;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export class CreateContentTypeCommand extends BaseCommand {
  public async run(opts: CreateContentTypeOptions = {}): Promise<void> {
    const isNonInteractive = Boolean(opts.name && (opts.fields || opts.fieldsJson));
    if (isNonInteractive) {
      this.runNonInteractive(opts);
      return;
    }

    // No TTY (e.g. spawned by the MCP server) — refuse to hang on prompts.
    if (!process.stdin.isTTY) {
      throw new Error(
        "create-content-type needs --name with --fields or --fields-json when stdin is not interactive.",
      );
    }

    await this.runInteractive(opts);
  }

  private write(
    name: string,
    contentDir: string,
    locales: string[],
    schema: Record<string, unknown>,
    wrapper: string,
  ): string {
    const baseDir = resolve(process.cwd(), contentDir, name);
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "schema.json"), JSON.stringify(schema, null, 2) + "\n");

    const emptyData = buildEmptyData(wrapper);
    for (const locale of locales) {
      const localeDir = join(baseDir, locale);
      mkdirSync(localeDir, { recursive: true });
      writeFileSync(join(localeDir, `${name}.json`), JSON.stringify(emptyData, null, 2) + "\n");
    }
    return baseDir;
  }

  private runNonInteractive(opts: CreateContentTypeOptions): void {
    const name = opts.name ?? "";
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const wrapper = opts.wrapper ?? "items";
    const locales = opts.locales ? opts.locales.split(",").map((l) => l.trim()) : ["en"];
    const contentDir = opts.contentDir ?? "src/content";

    const config: SchemaConfig = {
      schemaTitle: opts.title ?? `${capitalized}ContentSchema`,
      itemTitle: `${capitalized}Item`,
      wrapper,
      additionalProperties: false,
    };

    const fields = opts.fieldsJson
      ? parseFieldsJson(opts.fieldsJson)
      : parseFlatFields(opts.fields ?? "");

    const schema = buildContentSchema(config, fields);
    const baseDir = this.write(name, contentDir, locales, schema, wrapper);
    log.info(`✅ Created content type "${name}" at ${baseDir}`);
  }

  private async runInteractive(opts: CreateContentTypeOptions): Promise<void> {
    try {
      p.intro("📦 HyperJson — Create Content Type");

      const name = String(
        unwrap(
          await p.text({
            message: "Content type name (folder name):",
            placeholder: "education",
            initialValue: opts.name,
            validate: (v) => (!v ? "Required" : undefined),
          }),
        ),
      );
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

      const schemaTitle = String(
        unwrap(
          await p.text({ message: "Schema title:", initialValue: `${capitalized}ContentSchema` }),
        ),
      );
      const itemTitle = String(
        unwrap(
          await p.text({ message: "Item definition name:", initialValue: `${capitalized}Item` }),
        ),
      );
      const wrapper = String(
        unwrap(
          await p.text({
            message: "Top-level array property name:",
            initialValue: opts.wrapper ?? "items",
          }),
        ),
      );

      p.note(
        "Define the fields of one item. Pick 'object' or 'array' to nest, and name a\n" +
          "definition (then use 'ref') to build recursive types like trees or menus.",
        "Fields",
      );
      const fields = await promptFields(itemTitle, [itemTitle]);

      const localesRaw = String(
        unwrap(
          await p.text({
            message: "Locales (comma-separated):",
            placeholder: "en, pt-BR",
            initialValue: opts.locales ?? "en",
          }),
        ),
      );
      const locales = localesRaw
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);

      const additionalProperties = Boolean(
        unwrap(
          await p.confirm({
            message: "Allow additional (unknown) properties in the schema?",
            initialValue: false,
          }),
        ),
      );

      const config: SchemaConfig = { schemaTitle, itemTitle, wrapper, additionalProperties };
      const schema = buildContentSchema(config, fields);
      const contentDir = opts.contentDir ?? "src/content";
      this.write(name, contentDir, locales, schema, wrapper);

      p.outro(
        `Created content type "${name}" with ${fields.length} field(s) and ${locales.length} locale(s)`,
      );
    } catch (err) {
      if (err === CANCEL) {
        p.cancel("Cancelled");
        return;
      }
      throw err;
    }
  }
}
