import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

import type {
  FrontMatterContentType,
  FrontMatterPageFolder,
  FrontmatterConfigManager,
  FrontmatterField,
} from "./config.ts";

// ─── Field type union ─────────────────────────────────────────────────────────

/** All field type values recognised by the frontmatter schema. */
type FieldType =
  | "string"
  | "image"
  | "datetime"
  | "draft"
  | "tags"
  | "categories"
  | "choice"
  | (string & Record<never, never>); // allow unknown future types without losing narrowing

// ─── Schema builder ───────────────────────────────────────────────────────────

/**
 * Converts a frontmatter field definition to a JSON Schema fragment usable by AJV.
 */
function fieldToSchema(field: FrontmatterField): Record<string, unknown> {
  const type = field.type as FieldType;

  switch (type) {
    case "string":
    case "image":
    case "datetime":
      return { type: "string" };

    case "draft":
      return { type: "boolean" };

    case "tags":
    case "categories":
      return { type: "array", items: { type: "string" } };

    case "choice":
      return { type: "string", enum: field.choices ?? [] };

    default:
      return {};
  }
}

// ─── Validator ────────────────────────────────────────────────────────────────

export class FrontmatterValidator {
  private readonly ajv: Ajv;
  private validators: Record<string, ReturnType<Ajv["compile"]>> = {};
  private folderToTypes: Record<string, string[]> = {};

  constructor(
    private readonly configManager: FrontmatterConfigManager,
    private readonly workspaceDir: string,
    private readonly templatesDir?: string,
  ) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.buildValidators();
  }

  /**
   * Builds an AJV validator for each content type and maps page folder paths
   * to the content types they accept.
   */
  private buildValidators(): void {
    const contentTypes = this.configManager.getContentTypes() as FrontMatterContentType[];
    const pageFolders = this.configManager.getPageFolders() as FrontMatterPageFolder[];

    for (const ct of contentTypes) {
      const fields = (ct.fields ?? []) as FrontmatterField[];

      const schema: Record<string, unknown> = {
        type: "object",
        properties: {} as Record<string, unknown>,
        required: [] as string[],
        additionalProperties: true,
      };

      for (const field of fields) {
        (schema.properties as Record<string, unknown>)[field.name] = fieldToSchema(field);
      }

      // Try to derive required fields from the content-type template file
      if (this.templatesDir) {
        const templatePath = join(this.templatesDir, `${ct.name}.md`);
        if (existsSync(templatePath)) {
          const templateContent = readFileSync(templatePath, "utf-8");
          const match = templateContent.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            try {
              const parsed = parse(match[1]);
              if (parsed && typeof parsed === "object") {
                schema.required = Object.keys(parsed);
              }
            } catch {
              // Ignore invalid YAML in templates
            }
          }
        }
      }

      // Fall back to `required: true` flags on the fields themselves
      if ((schema.required as string[]).length === 0) {
        schema.required = fields.filter((f) => f.required).map((f) => f.name);
      }

      this.validators[ct.name as string] = this.ajv.compile(schema);
    }

    for (const folder of pageFolders) {
      const absPath = folder.path.replace("[[workspace]]", this.workspaceDir);
      this.folderToTypes[absPath] = folder.contentTypes ?? [];
    }
  }

  /**
   * Validates `data` against the content type(s) associated with `filePath`.
   * Returns `{ isValid: true }` when no content type is configured for the path.
   */
  public validate(data: unknown, filePath: string): { isValid: boolean; errors: unknown[] } {
    let matchedTypes: string[] = [];

    for (const [folderPath, types] of Object.entries(this.folderToTypes)) {
      if (filePath.startsWith(folderPath)) {
        matchedTypes = types;
        break;
      }
    }

    if (matchedTypes.length === 0) {
      return { isValid: true, errors: [] }; // No config for this path — skip
    }

    let isValid = false;
    let errors: unknown[] = [];

    for (const typeName of matchedTypes) {
      const validate = this.validators[typeName];
      if (!validate) continue;

      if (validate(data)) {
        isValid = true;
        break;
      }

      errors = errors.concat(validate.errors ?? []);
    }

    return { isValid, errors };
  }
}
