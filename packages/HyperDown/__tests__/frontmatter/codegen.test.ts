import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { HyperDownCodegen } from "../../src/frontmatter/codegen.ts";

// Drives the real codegen against real config files and asserts the emitted
// TypeScript — no mocks. HyperDownCodegen(appDir) reads hyperdown.config.json +
// frontmatter.json and writes the .hyper-down/ tree the Vite plugin generates.

let dir: string;
const read = (...p: string[]) => readFileSync(join(dir, ...p), "utf-8");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hd-codegen-"));

  writeFileSync(
    join(dir, "hyperdown.config.json"),
    JSON.stringify({
      database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
    }),
  );
  writeFileSync(
    join(dir, "frontmatter.json"),
    JSON.stringify({
      "frontMatter.taxonomy.contentTypes": [
        {
          name: "article",
          fields: [
            { title: "Title", name: "title", type: "string" },
            { title: "Tags", name: "tags", type: "tags" },
            { title: "Draft", name: "draft", type: "draft" },
          ],
        },
      ],
      "frontMatter.content.pageFolders": [
        { title: "Articles", path: "[[workspace]]/content/article", contentTypes: ["article"] },
      ],
    }),
  );

  new HyperDownCodegen(dir).generate();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("HyperDownCodegen.generate", () => {
  test("emits a typed metadata interface for the content type", () => {
    const types = read(".hyper-down", "content", "article", "types.ts");
    expect(types).toContain("export interface ArticleMeta extends ContentMeta");
    expect(types).toContain("title");
    expect(types).toContain("tags");
    expect(types).toContain("DO NOT EDIT"); // generated banner
  });

  test("emits a lazy repository Proxy builder for the type", () => {
    const builder = read(".hyper-down", "content", "article", "builder.ts");
    expect(builder).toContain("articleRepository");
    expect(builder).toContain("createLazyRepository");
    expect(builder).toContain("ArticleMeta");
  });

  test("emits a static eager import.meta.glob of the type's MDX bodies", () => {
    const modules = read(".hyper-down", "content", "article", "modules.ts");
    // The glob MUST be a static string literal (Vite cannot transform a template).
    expect(modules).toContain('import.meta.glob("/content/article/**/*.mdx", { eager: true })');
  });

  test("emits the default barrel exposing contentModules keyed by type", () => {
    const barrel = read(".hyper-down", "default.ts");
    expect(barrel).toContain("export const contentModules");
    expect(barrel).toContain("article");
    expect(barrel).toContain("export type ContentType");
  });

  test("is idempotent — a second run leaves byte-identical files", () => {
    const before = read(".hyper-down", "content", "article", "types.ts");
    new HyperDownCodegen(dir).generate();
    expect(read(".hyper-down", "content", "article", "types.ts")).toBe(before);
  });
});
