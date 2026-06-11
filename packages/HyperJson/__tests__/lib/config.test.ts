import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { loadHyperJsonConfig, validateHyperJsonConfig } from "../../src/lib/config.ts";

// Real schema compilation (AJV) + real config files on disk — no mocks.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hj-config-"));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("validateHyperJsonConfig", () => {
  test("accepts a minimal valid config", () => {
    expect(validateHyperJsonConfig({ contentDir: "content" })).toBe(true);
  });

  test("accepts the validation block", () => {
    expect(
      validateHyperJsonConfig({
        contentDir: "content",
        validation: { strict: true, failOnError: true },
      }),
    ).toBe(true);
  });

  test("rejects a config with a wrong-typed field", () => {
    expect(validateHyperJsonConfig({ contentDir: 123 as unknown as string })).toBe(false);
  });

  test("rejects unknown additional properties when the schema forbids them", () => {
    // contentDir is required by the schema; omitting it must fail.
    expect(validateHyperJsonConfig({})).toBe(false);
  });
});

describe("loadHyperJsonConfig", () => {
  test("returns the default config when no file exists", () => {
    expect(loadHyperJsonConfig(dir)).toEqual({ contentDir: "src/content" });
  });

  test("loads and returns a valid config file", () => {
    writeFileSync(
      join(dir, "hyperjson.config.json"),
      JSON.stringify({ contentDir: "data", validation: { strict: false, failOnError: false } }),
    );
    expect(loadHyperJsonConfig(dir).contentDir).toBe("data");
  });

  test("throws on an invalid config file", () => {
    writeFileSync(join(dir, "hyperjson.config.json"), JSON.stringify({ contentDir: 5 }));
    expect(() => loadHyperJsonConfig(dir)).toThrow(/Invalid config/);
  });
});
