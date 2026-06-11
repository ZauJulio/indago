import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { FrontmatterConfigManager } from "../../src/frontmatter/config.ts";

// Real JSON files on disk — no mocks.

let dir: string;
let configPath: string;

const CONFIG = {
  "frontMatter.taxonomy.contentTypes": [
    { name: "article", fields: [{ title: "Title", name: "title", type: "string" }] },
    { name: "recipe", fields: [] },
  ],
  "frontMatter.content.pageFolders": [
    { title: "Articles", path: "[[workspace]]/content/article", contentTypes: ["article"] },
  ],
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hd-config-"));
  configPath = join(dir, "frontmatter.json");
  writeFileSync(configPath, JSON.stringify(CONFIG));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("FrontmatterConfigManager", () => {
  test("loads content types and page folders from a real file", () => {
    const m = new FrontmatterConfigManager(configPath);
    expect(m.getContentTypes().map((c) => c.name)).toEqual(["article", "recipe"]);
    expect(m.getPageFolders()[0].title).toBe("Articles");
  });

  test("getContentTypeByName finds an existing type and returns undefined otherwise", () => {
    const m = new FrontmatterConfigManager(configPath);
    expect(m.getContentTypeByName("recipe")?.name).toBe("recipe");
    expect(m.getContentTypeByName("missing")).toBeUndefined();
  });

  test("caches the parsed config — editing the file after first load has no effect", () => {
    const m = new FrontmatterConfigManager(configPath);
    expect(m.getContentTypes()).toHaveLength(2);
    writeFileSync(configPath, JSON.stringify({ "frontMatter.taxonomy.contentTypes": [] }));
    expect(m.getContentTypes()).toHaveLength(2); // served from cache
  });

  test("returns empty arrays when the keys are absent", () => {
    writeFileSync(configPath, JSON.stringify({}));
    const m = new FrontmatterConfigManager(configPath);
    expect(m.getContentTypes()).toEqual([]);
    expect(m.getPageFolders()).toEqual([]);
  });

  test("throws a clear error when the config file does not exist", () => {
    const m = new FrontmatterConfigManager(join(dir, "nope.json"));
    expect(() => m.loadConfig()).toThrow(/not found/i);
  });
});
