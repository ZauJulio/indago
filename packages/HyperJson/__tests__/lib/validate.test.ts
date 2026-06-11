import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { validateContentSchemas } from "../../src/lib/validate.ts";

// Exercises the real Ajv-backed content validator against real files on disk.

const SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ThingContentSchema",
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { $ref: "#/definitions/Thing" } } },
  definitions: {
    Thing: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
  },
};

let contentDir: string;
beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), "hyperjson-validate-"));
  const thing = join(contentDir, "thing");
  mkdirSync(join(thing, "en"), { recursive: true });
  writeFileSync(join(thing, "schema.json"), JSON.stringify(SCHEMA));
});
afterEach(() => rmSync(contentDir, { recursive: true, force: true }));

describe("validateContentSchemas", () => {
  test("passes a conformant file and fails a non-conformant one", () => {
    writeFileSync(
      join(contentDir, "thing", "en", "good.json"),
      JSON.stringify({ items: [{ name: "ok" }] }),
    );
    writeFileSync(join(contentDir, "thing", "en", "bad.json"), JSON.stringify({ items: [{}] }));

    const { passed, failed, results, schemaDirs } = validateContentSchemas(contentDir);

    expect(passed).toBe(1);
    expect(failed).toBe(1);
    expect(schemaDirs).toHaveLength(1);

    const bad = results.find((r) => r.file.endsWith("bad.json"));
    expect(bad?.valid).toBe(false);
    expect(bad?.errors?.join(" ")).toContain("name");
  });

  test("reports a parse error as a failed result rather than throwing", () => {
    writeFileSync(join(contentDir, "thing", "en", "broken.json"), "{ not json");

    const { failed, results } = validateContentSchemas(contentDir);
    expect(failed).toBe(1);
    expect(results[0].valid).toBe(false);
  });
});
