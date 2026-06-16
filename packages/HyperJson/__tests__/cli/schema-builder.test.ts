import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  buildContentSchema,
  parseFieldsJson,
  parseFlatFields,
  type SchemaConfig,
} from "../../cli/commands/schema-builder.ts";
import { cleanup, makeTempProject, runCli } from "../helpers.ts";

const config: SchemaConfig = {
  schemaTitle: "DemoContentSchema",
  itemTitle: "DemoItem",
  wrapper: "items",
  additionalProperties: false,
};

/** Walk a nested JSON Schema by keys, returning `unknown` (no `any`). */
function get(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    cur = (cur as Record<string, unknown> | undefined)?.[key];
  }
  return cur;
}

const itemProp = (schema: unknown, ...keys: string[]): unknown =>
  get(schema, "definitions", "DemoItem", "properties", ...keys);

describe("buildContentSchema — flat (backward compatible)", () => {
  test("flat string fields produce the legacy shape", () => {
    const schema = buildContentSchema(config, parseFlatFields("name:string:required;url:string"));

    expect(get(schema, "title")).toBe("DemoContentSchema");
    expect(get(schema, "required")).toEqual(["items"]);
    expect(get(schema, "definitions", "DemoItem", "required")).toEqual(["name"]);
    expect(itemProp(schema, "url", "type")).toBe("string");
  });

  test("string[] maps to an array of strings", () => {
    const schema = buildContentSchema(config, parseFlatFields("tags:string[]"));

    expect(itemProp(schema, "tags", "type")).toBe("array");
    expect(itemProp(schema, "tags", "items")).toEqual({ type: "string" });
  });
});

describe("buildContentSchema — nested objects and arrays", () => {
  test("nested object inlines its properties", () => {
    const schema = buildContentSchema(
      config,
      parseFieldsJson(
        JSON.stringify([
          {
            name: "author",
            type: "object",
            required: true,
            fields: [
              { name: "name", type: "string", required: true },
              { name: "site", type: "string", format: "uri" },
            ],
          },
        ]),
      ),
    );

    expect(itemProp(schema, "author", "type")).toBe("object");
    expect(itemProp(schema, "author", "properties", "name")).toEqual({ type: "string" });
    expect(itemProp(schema, "author", "properties", "site")).toEqual({
      type: "string",
      format: "uri",
    });
    expect(itemProp(schema, "author", "required")).toEqual(["name"]);
  });

  test("array of objects nests the element schema under items", () => {
    const schema = buildContentSchema(
      config,
      parseFieldsJson(
        JSON.stringify([
          {
            name: "links",
            type: "array",
            items: {
              name: "",
              type: "object",
              fields: [{ name: "url", type: "string", required: true }],
            },
          },
        ]),
      ),
    );

    expect(itemProp(schema, "links", "type")).toBe("array");
    expect(itemProp(schema, "links", "items", "type")).toBe("object");
    expect(itemProp(schema, "links", "items", "properties", "url")).toEqual({ type: "string" });
  });
});

describe("buildContentSchema — recursion via named definitions", () => {
  test("a self-referencing tree resolves through $ref", () => {
    const menuConfig: SchemaConfig = { ...config, itemTitle: "MenuItem" };
    const schema = buildContentSchema(
      menuConfig,
      parseFieldsJson(
        JSON.stringify([
          { name: "label", type: "string", required: true },
          { name: "children", type: "array", items: { name: "", type: "ref", ref: "MenuItem" } },
        ]),
      ),
    );

    expect(get(schema, "definitions", "MenuItem", "properties", "children", "type")).toBe("array");
    expect(get(schema, "definitions", "MenuItem", "properties", "children", "items")).toEqual({
      $ref: "#/definitions/MenuItem",
    });
  });

  test("a named nested definition is hoisted into definitions", () => {
    const schema = buildContentSchema(
      config,
      parseFieldsJson(
        JSON.stringify([
          {
            name: "root",
            type: "object",
            def: "Node",
            fields: [
              { name: "value", type: "string", required: true },
              { name: "next", type: "ref", ref: "Node" },
            ],
          },
        ]),
      ),
    );

    expect(get(schema, "definitions", "Node", "type")).toBe("object");
    expect(itemProp(schema, "root")).toEqual({ $ref: "#/definitions/Node" });
    expect(get(schema, "definitions", "Node", "properties", "next")).toEqual({
      $ref: "#/definitions/Node",
    });
  });
});

describe("parseFieldsJson — validation", () => {
  test("rejects non-array input", () => {
    expect(() => parseFieldsJson('{"name":"x"}')).toThrow(/must be a JSON array/);
  });

  test("rejects a ref without a target", () => {
    expect(() => parseFieldsJson('[{"name":"x","type":"ref"}]')).toThrow(/no "ref" target/);
  });
});

describe("create-content-type --fields-json (end to end)", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTempProject();
  });
  afterEach(() => cleanup(dir));

  test("scaffolds, validates and generates types for a recursive schema", () => {
    runCli(["init"], dir);

    const fieldsJson = JSON.stringify([
      { name: "label", type: "string", required: true },
      { name: "children", type: "array", items: { name: "", type: "ref", ref: "MenuItem" } },
    ]);
    const res = runCli(
      ["create-content-type", "--name", "menu", "--fields-json", fieldsJson, "--locales", "en"],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const schemaPath = join(dir, "src", "content", "menu", "schema.json");
    expect(existsSync(schemaPath)).toBe(true);

    // The freshly scaffolded (empty) content validates against the recursive schema.
    expect(runCli(["validate", "both"], dir).exitCode).toBe(0);

    // json-schema-to-typescript emits a recursive interface.
    expect(runCli(["generate"], dir).exitCode).toBe(0);
    const ts = readFileSync(
      join(dir, ".hyper-json", "src", "content", "menu", "types.ts"),
      "utf-8",
    );
    expect(ts).toContain("MenuItem");
  });
});
