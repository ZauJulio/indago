import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseFrontmatter } from "@indago/hyper-down";
import { describe, expect, it } from "vitest";

// Standardized unit test shipped to every template: validates the shared content
// tree independently of the rendering framework. Runs under each app's `test`.

const CONTENT = join(process.cwd(), "content");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("content integrity", () => {
  const files = walk(CONTENT);

  it("ships article + recipe MDX in both locales", () => {
    const mdx = files.filter((f) => f.endsWith(".mdx"));
    expect(mdx.some((f) => f.includes("/article/en/"))).toBe(true);
    expect(mdx.some((f) => f.includes("/article/pt-BR/"))).toBe(true);
    expect(mdx.some((f) => f.includes("/recipe/en/"))).toBe(true);
    expect(mdx.some((f) => f.includes("/recipe/pt-BR/"))).toBe(true);
  });

  it("every MDX file has a title + date in its frontmatter", () => {
    for (const file of files.filter((f) => f.endsWith(".mdx"))) {
      const { data } = parseFrontmatter(readFileSync(file, "utf8"));
      expect(typeof data.title, file).toBe("string");
      expect(String(data.title ?? "").length, file).toBeGreaterThan(0);
      expect(data.date, file).toBeDefined();
    }
  });

  it("ships a schema-validated projects collection", () => {
    const projects = JSON.parse(
      readFileSync(join(CONTENT, "projects/en/projects.json"), "utf8"),
    ) as { projects: Array<{ name: string; url: string }> };
    expect(Array.isArray(projects.projects)).toBe(true);
    expect(projects.projects.length).toBeGreaterThan(0);
    for (const p of projects.projects) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.url).toBe("string");
    }
  });
});
