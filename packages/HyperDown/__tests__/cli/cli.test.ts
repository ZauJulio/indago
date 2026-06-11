import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanup, makeTempProject, runCli } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = makeTempProject();
});
afterEach(() => cleanup(dir));

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

describe("hyperdown init", () => {
  test("scaffolds config + frontmatter schema", () => {
    const res = runCli(["init", "both"], dir);

    expect(res.exitCode).toBe(0);
    expect(existsSync(join(dir, "hyperdown.config.json"))).toBe(true);
    expect(existsSync(join(dir, "frontmatter.schema.json"))).toBe(true);

    // The generated config is internally consistent JSON.
    const config = readJson(join(dir, "hyperdown.config.json"));
    expect(config.database.contentDir).toBeString();
    expect(config.i18n.defaultLocale).toBe("en");
  });

  test("is idempotent — re-running does not error or clobber", () => {
    runCli(["init", "config"], dir);
    const first = readFileSync(join(dir, "hyperdown.config.json"), "utf-8");

    const res = runCli(["init", "config"], dir);
    expect(res.exitCode).toBe(0);
    expect(readFileSync(join(dir, "hyperdown.config.json"), "utf-8")).toBe(first);
  });
});

describe("hyperdown validate", () => {
  test("passes for a freshly scaffolded config", () => {
    runCli(["init", "config"], dir);

    const res = runCli(["validate", "config"], dir);
    expect(res.exitCode).toBe(0);
  });

  test("exits non-zero for a schema-violating config", () => {
    // Present but invalid (missing required keys, unknown property).
    writeFileSync(join(dir, "hyperdown.config.json"), JSON.stringify({ unexpected: true }));

    const res = runCli(["validate", "config"], dir);
    expect(res.exitCode).toBe(1);
  });
});

describe("hyperdown create-frontmatter", () => {
  test("writes a valid frontmatter.json and locale directories", () => {
    const res = runCli(
      [
        "create-frontmatter",
        "--name",
        "article",
        "--locales",
        "en,pt-BR",
        "--content-dir",
        "content",
      ],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const fmPath = join(dir, "frontmatter.json");
    expect(existsSync(fmPath)).toBe(true);

    const fm = readJson(fmPath);
    const types = fm["frontMatter.taxonomy.contentTypes"];
    expect(types.map((t: { name: string }) => t.name)).toContain("article");

    expect(existsSync(join(dir, "content", "article", "en"))).toBe(true);
    expect(existsSync(join(dir, "content", "article", "pt-BR"))).toBe(true);

    // And the output it produced validates against the bundled schema.
    expect(runCli(["validate", "frontmatter"], dir).exitCode).toBe(0);
  });
});

describe("hyperdown create-content", () => {
  test("adds a new content type to an existing frontmatter.json", () => {
    runCli(["create-frontmatter", "--name", "article", "--content-dir", "content"], dir);

    const res = runCli(
      [
        "create-content",
        "--name",
        "product",
        "--folder",
        "Products",
        "--fields",
        "title:string:req,price:number:opt",
      ],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const fm = readJson(join(dir, "frontmatter.json"));
    const names = fm["frontMatter.taxonomy.contentTypes"].map((t: { name: string }) => t.name);
    expect(names).toContain("product");
  });
});

describe("hyperdown create-item", () => {
  test("creates an .mdx item under the type/locale folder", () => {
    runCli(["create-frontmatter", "--name", "article", "--content-dir", "content"], dir);

    const res = runCli(
      ["create-item", "--type", "article", "--slug", "hello-world", "--lang", "en"],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const itemPath = join(dir, "content", "article", "en", "hello-world.mdx");
    expect(existsSync(itemPath)).toBe(true);

    const raw = readFileSync(itemPath, "utf-8");
    expect(raw.startsWith("---")).toBe(true);
    expect(raw).toContain("title:");
  });
});
