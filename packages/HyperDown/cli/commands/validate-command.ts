import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as p from "@clack/prompts";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import { BaseCommand } from "./base-command.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Non-standard annotation keywords used by the bundled FrontMatter CMS schema
 * (`frontmatter.schema.json`) and by VS Code's JSON schema tooling. They carry
 * editor metadata only and have no effect on validation, so they are declared
 * as a no-op vocabulary to keep Ajv's strict mode enabled without rejecting the
 * schema at compile time. The schema is vendored (downloaded, not fetched at
 * runtime), so this list fully covers the keywords it can contain.
 */
const FRONTMATTER_VENDOR_KEYWORDS = [
  "markdownDescription",
  "scope",
  "lastModified",
  "enumDescriptions",
  "markdownEnumDescriptions",
  "defaultSnippets",
  "deprecationMessage",
  "patternErrorMessage",
  "errorMessage",
  "doNotSuggest",
  "allowComments",
  "allowTrailingCommas",
];

interface ValidateOptions {
  /** Path to the file matching the selected target. Ignored when target is "both". */
  path?: string;
}

export class ValidateCommand extends BaseCommand {
  private ajv: Ajv;

  constructor() {
    super();
    // Strict mode is on so typos and malformed constructs in our own
    // `hyperdown.config.schema.json` are caught at compile time. The vendored
    // FrontMatter schema is made strict-compatible by (1) declaring its vendor
    // annotation keywords as a no-op vocabulary, and (2) `allowUnionTypes` for
    // its legitimate `type: [...]` unions. `strictTuples`/`strictRequired` are
    // relaxed: both flag upstream FrontMatter schema-authoring style (tuple
    // `items`, `required` referencing parent-scoped properties) we don't own,
    // not validation correctness.
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      allowUnionTypes: true,
      strictTuples: false,
      strictRequired: false,
    });
    addFormats(this.ajv);
    this.ajv.addVocabulary(FRONTMATTER_VENDOR_KEYWORDS);
  }

  public async run(target: string | boolean, opts: ValidateOptions = {}): Promise<void> {
    await this.executeSafely(() => {
      const t = target === true ? "both" : target;
      let hasError = false;

      // --path applies only to a single explicit target; "both" uses defaults.
      if (t === "config" || t === "both") {
        hasError = this.validateConfig(t === "config" ? opts.path : undefined) || hasError;
      }

      if (t === "frontmatter" || t === "both") {
        hasError =
          this.validateFrontmatter(t === "frontmatter" ? opts.path : undefined) || hasError;
      }

      if (hasError) {
        process.exit(1);
      }
    });
  }

  private validateConfig(configPath?: string): boolean {
    const resolved = configPath
      ? resolve(process.cwd(), configPath)
      : resolve(process.cwd(), "hyperdown.config.json");
    const schemaPath = resolve(__dirname, "../../schemas/hyperdown.config.schema.json");

    if (!existsSync(resolved) || !existsSync(schemaPath)) {
      p.log.warning("hyperdown.config.json or its schema is missing, skipping config validation.");
      return false;
    }

    return this.validateFile(resolved, schemaPath, "hyperdown.config.json");
  }

  private validateFrontmatter(frontmatterPath?: string): boolean {
    const fmPath = frontmatterPath
      ? resolve(process.cwd(), frontmatterPath)
      : resolve(process.cwd(), "frontmatter.json");
    const fmSchemaPath = resolve(__dirname, "../../schemas/frontmatter.schema.json");

    if (!existsSync(fmPath) || !existsSync(fmSchemaPath)) {
      p.log.warning("frontmatter.json or its schema is missing, skipping frontmatter validation.");
      return false;
    }

    return this.validateFile(fmPath, fmSchemaPath, "frontmatter.json");
  }

  private validateFile(dataPath: string, schemaPath: string, name: string): boolean {
    try {
      const data = JSON.parse(readFileSync(dataPath, "utf-8"));
      const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

      // The FrontMatter CMS schema contains recursive self-references by file
      // name (e.g. {"$ref": "frontmatter.schema.json"}). Registering the schema
      // under that file name as its `$id` lets Ajv resolve them to the root.
      if (!schema.$id) schema.$id = basename(schemaPath);
      if (this.ajv.getSchema(schema.$id)) this.ajv.removeSchema(schema.$id);

      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (!valid) {
        p.log.error(`Invalid ${name}:`);
        for (const error of validate.errors ?? []) {
          p.log.error(`  ${error.instancePath} ${error.message}`);
        }
        return true;
      }

      p.log.success(`${name} is valid`);
      return false;
    } catch (err: unknown) {
      p.log.error(`Failed to validate ${name}: ${(err as Error).message}`);
      return true;
    }
  }
}
