import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanup, makeTempProject, runCli } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = makeTempProject();
});
afterEach(() => cleanup(dir));

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

/** Scaffolds `src/content/projects` (schema + empty data) in the temp project. */
function scaffoldProjects(): void {
  runCli(["init"], dir);
  runCli(
    [
      "create-content-type",
      "--name",
      "projects",
      "--fields",
      "name:string:required;url:string",
      "--locales",
      "en",
    ],
    dir,
  );
}

describe("hyperjson init", () => {
  test("scaffolds hyperjson.config.json", () => {
    const res = runCli(["init"], dir);

    expect(res.exitCode).toBe(0);
    const config = readJson(join(dir, "hyperjson.config.json"));
    expect(config.contentDir).toBe("src/content");
    expect(config.validation.strict).toBe(true);
  });
});

describe("hyperjson create-content-type", () => {
  test("writes a schema.json and an empty data file per locale", () => {
    scaffoldProjects();

    const schemaPath = join(dir, "src", "content", "projects", "schema.json");
    expect(existsSync(schemaPath)).toBe(true);

    const schema = readJson(schemaPath);
    expect(schema.title).toBe("ProjectsContentSchema");
    expect(schema.required).toEqual(["items"]);
    expect(schema.definitions.ProjectsItem.required).toEqual(["name"]);

    expect(readJson(join(dir, "src", "content", "projects", "en", "projects.json"))).toEqual({
      items: [],
    });
  });
});

describe("hyperjson validate", () => {
  test("passes for freshly scaffolded, schema-conformant content", () => {
    scaffoldProjects();

    expect(runCli(["validate", "both"], dir).exitCode).toBe(0);
  });

  test("exits non-zero when a content file violates its schema", () => {
    scaffoldProjects();

    // An item missing the required `name` field.
    writeFileSync(
      join(dir, "src", "content", "projects", "en", "projects.json"),
      JSON.stringify({ items: [{ url: "https://example.com" }] }),
    );

    expect(runCli(["validate", "content"], dir).exitCode).toBe(1);
  });
});

describe("hyperjson generate", () => {
  // `generate` regenerates the package-owned config types as a side effect;
  // snapshot and restore that one file so the test leaves the repo untouched.
  const packageTypes = resolve(import.meta.dir, "../../src/lib/types.ts");
  let snapshot: string;
  beforeEach(() => {
    snapshot = readFileSync(packageTypes, "utf-8");
  });
  afterEach(() => {
    writeFileSync(packageTypes, snapshot);
  });

  test("emits a TypeScript module declaration for each schema", () => {
    scaffoldProjects();

    const res = runCli(["generate"], dir);
    expect(res.exitCode).toBe(0);

    const typesPath = join(dir, ".hyper-json", "src", "content", "projects", "types.ts");
    expect(existsSync(typesPath)).toBe(true);

    const ts = readFileSync(typesPath, "utf-8");
    expect(ts).toContain('declare module "@indago/hyper-json"');
    expect(ts).toContain("ProjectsContentSchema");
  });
});
