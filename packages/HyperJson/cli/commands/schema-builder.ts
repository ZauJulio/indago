/**
 * Pure JSON-Schema builder for HyperJson content types.
 *
 * Shared by every entry point of `create-content-type`:
 *   - the interactive (clack) prompts,
 *   - the legacy flat `--fields` string ("name:type[:required];…"),
 *   - the structured `--fields-json` payload (also used by the MCP server).
 *
 * It supports arbitrary nesting — objects within objects, arrays of objects,
 * and recursion via named definitions referenced with `$ref` (e.g. a tree node
 * whose `children` are the same type).
 */

export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "enum"
  | "object"
  | "array"
  | "ref";

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  /** `enum`: the allowed string values. */
  enumValues?: string[];
  /** `string`: optional JSON Schema `format` (uri, email, uuid, date-time, …). */
  format?: string;
  /** `object`: the nested fields. */
  fields?: FieldSpec[];
  /** `array`: the element spec (its `name` is ignored). */
  items?: FieldSpec;
  /**
   * `object`: register this object as a named, reusable definition so it can be
   * referenced (including by itself) with `ref` — this is what enables recursion.
   */
  def?: string;
  /** `ref`: the name of a definition to reference (e.g. the item title, for a recursive tree). */
  ref?: string;
}

export interface SchemaConfig {
  schemaTitle: string;
  itemTitle: string;
  wrapper: string;
  additionalProperties: boolean;
}

type JsonSchema = Record<string, unknown>;

interface BuildState {
  /** Extra named definitions produced while walking nested `def` objects. */
  definitions: Record<string, JsonSchema>;
  /** Definition names already registered (creation order; includes the item title). */
  available: Set<string>;
}

const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

function leafSchema(spec: FieldSpec): JsonSchema {
  switch (spec.type) {
    case "number":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", pattern: DATE_PATTERN };
    case "enum":
      return spec.enumValues && spec.enumValues.length > 0
        ? { type: "string", enum: spec.enumValues }
        : { type: "string" };
    default:
      return spec.format ? { type: "string", format: spec.format } : { type: "string" };
  }
}

function propertyFor(spec: FieldSpec, state: BuildState): JsonSchema {
  switch (spec.type) {
    case "object":
      return objectFor(spec, state);
    case "array": {
      const element = spec.items ?? { name: "", type: "string" as const };
      return { type: "array", items: propertyFor(element, state) };
    }
    case "ref":
      return { $ref: `#/definitions/${spec.ref}` };
    default:
      return leafSchema(spec);
  }
}

/** Build an `object` schema; if `spec.def` is set, hoist it into `definitions` and return a `$ref`. */
function objectFor(spec: FieldSpec, state: BuildState): JsonSchema {
  const name = spec.def?.trim();

  if (name) {
    if (!state.available.has(name)) {
      // Register the name *before* recursing so the object may reference itself.
      state.available.add(name);
      state.definitions[name] = buildObject(spec.fields ?? [], state, name);
    }
    return { $ref: `#/definitions/${name}` };
  }

  return buildObject(spec.fields ?? [], state);
}

function buildObject(fields: FieldSpec[], state: BuildState, title?: string): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.name] = propertyFor(field, state);
    if (field.required) required.push(field.name);
  }

  const schema: JsonSchema = {};
  if (title) schema.title = title;
  schema.type = "object";
  schema.properties = properties;
  schema.required = required;
  return schema;
}

/** Build the full content-type schema (wrapper array of the item definition). */
export function buildContentSchema(config: SchemaConfig, fields: FieldSpec[]): JsonSchema {
  const state: BuildState = { definitions: {}, available: new Set([config.itemTitle]) };

  // The item definition itself may be referenced recursively via `ref: <itemTitle>`.
  const itemSchema = buildObject(fields, state, config.itemTitle);

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: config.schemaTitle,
    type: "object",
    properties: {
      [config.wrapper]: {
        type: "array",
        items: { $ref: `#/definitions/${config.itemTitle}` },
      },
    },
    required: [config.wrapper],
    additionalProperties: config.additionalProperties,
    definitions: { [config.itemTitle]: itemSchema, ...state.definitions },
  };
}

export function buildEmptyData(wrapper: string): Record<string, unknown> {
  return { [wrapper]: [] };
}

// ─── Non-interactive parsers ──────────────────────────────────────────────────

/** Parse the legacy flat `--fields` string: `name:type[:required]` joined by `;`. */
export function parseFlatFields(raw: string): FieldSpec[] {
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, rawType = "string", req] = entry.split(":");
      const required = req === "required";

      if (rawType === "string[]") {
        return { name, type: "array", items: { name: "", type: "string" }, required } as FieldSpec;
      }

      const known: FieldType[] = ["string", "number", "integer", "boolean", "date", "enum"];
      const type = (known as string[]).includes(rawType) ? (rawType as FieldType) : "string";
      return { name, type, required };
    });
}

/** Parse and lightly validate a structured `--fields-json` payload. */
export function parseFieldsJson(raw: string): FieldSpec[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`--fields-json is not valid JSON: ${msg}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("--fields-json must be a JSON array of field specs.");
  }

  return parsed.map((field, i) => validateFieldSpec(field, `[${i}]`, true));
}

const VALID_TYPES = new Set<string>([
  "string",
  "number",
  "integer",
  "boolean",
  "date",
  "enum",
  "object",
  "array",
  "ref",
]);

function validateFieldSpec(value: unknown, path: string, requireName: boolean): FieldSpec {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Field ${path} must be an object.`);
  }

  const field = value as Record<string, unknown>;

  // Array element specs (`items`) carry no meaningful name — it is ignored.
  if (requireName && (typeof field.name !== "string" || !field.name)) {
    throw new Error(`Field ${path} is missing a non-empty "name".`);
  }
  if (typeof field.type !== "string" || !VALID_TYPES.has(field.type)) {
    const label = typeof field.name === "string" ? field.name : path;
    throw new Error(`Field ${path} ("${label}") has an invalid "type": ${String(field.type)}`);
  }

  const spec: FieldSpec = {
    name: typeof field.name === "string" ? field.name : "",
    type: field.type as FieldType,
  };

  if (typeof field.required === "boolean") spec.required = field.required;
  if (typeof field.format === "string") spec.format = field.format;
  if (typeof field.def === "string") spec.def = field.def;
  if (typeof field.ref === "string") spec.ref = field.ref;
  if (Array.isArray(field.enumValues)) {
    spec.enumValues = field.enumValues.map(String);
  }
  if (Array.isArray(field.fields)) {
    spec.fields = field.fields.map((f, i) => validateFieldSpec(f, `${path}.fields[${i}]`, true));
  }
  if (field.items !== undefined) {
    spec.items = validateFieldSpec(field.items, `${path}.items`, false);
  }

  if (spec.type === "ref" && !spec.ref) {
    throw new Error(`Field ${path} ("${spec.name}") is a "ref" but has no "ref" target.`);
  }

  return spec;
}
