import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { hyperdownSitemapPlugin } from "../../src/plugins/sitemap.ts";

// Integration: run the real Vite sitemap plugin's closeBundle against a real
// config + real .mdx files and assert the generated sitemap.xml — no mocks.
// The plugin guards itself with a module-level `_sitemapRan` flag, so it can run
// only ONCE per process; hence a single beforeAll build + multiple assertions.

let dir: string;
let xml: string;
const SITE = "https://example.test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "hd-sitemap-"));

  writeFileSync(
    join(dir, "frontmatter.json"),
    JSON.stringify({ "frontMatter.taxonomy.contentTypes": [{ name: "article", fields: [] }] }),
  );

  writeFileSync(
    join(dir, "hyperdown.config.json"),
    JSON.stringify({
      database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
      sitemap: {
        siteUrl: SITE,
        outputPath: "./sitemap.xml",
        staticRoutes: [
          { path: "/", priority: "1.0", changefreq: "weekly" },
          { path: "/articles", priority: "0.8", changefreq: "weekly" },
        ],
        contentTypes: [
          { name: "article", basePath: "/articles", priority: "0.7", changefreq: "monthly" },
        ],
      },
      i18n: { defaultLocale: "en", locales: ["en", "pt-BR"], strategy: "folder", filePattern: {} },
    }),
  );

  const enDir = join(dir, "content", "article", "en");
  const ptDir = join(dir, "content", "article", "pt-BR");
  mkdirSync(enDir, { recursive: true });
  mkdirSync(ptDir, { recursive: true });
  writeFileSync(join(enDir, "hello.mdx"), "---\ntitle: Hello\ndate: 2026-01-02\n---\nBody\n");
  writeFileSync(join(ptDir, "hello.mdx"), "---\ntitle: Ola\ndate: 2026-01-03\n---\nCorpo\n");

  const plugin = hyperdownSitemapPlugin({ configPath: join(dir, "hyperdown.config.json") });
  plugin.closeBundle();

  xml = readFileSync(join(dir, "sitemap.xml"), "utf-8");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("hyperdownSitemapPlugin", () => {
  test("declares a build-only Vite plugin", () => {
    const plugin = hyperdownSitemapPlugin();
    expect(plugin.name).toBe("vite-plugin-hyperdown-sitemap");
    expect(plugin.apply).toBe("build");
  });

  test("emits a valid sitemap urlset document", () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  test("includes every configured static route with its priority", () => {
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/articles</loc>`);
    expect(xml).toContain("<priority>1.0</priority>");
  });

  test("emits the default-locale content URL without a prefix", () => {
    expect(xml).toContain(`<loc>${SITE}/articles/hello</loc>`);
  });

  test("prefixes the non-default-locale (pt-BR) content URL with /pt", () => {
    expect(xml).toContain(`<loc>${SITE}/pt/articles/hello</loc>`);
  });

  test("uses the front-matter date as lastmod for content URLs", () => {
    expect(xml).toContain("<lastmod>2026-01-02</lastmod>"); // en/hello
    expect(xml).toContain("<lastmod>2026-01-03</lastmod>"); // pt-BR/hello
  });

  test("applies the content type's changefreq/priority", () => {
    expect(xml).toContain("<changefreq>monthly</changefreq>");
    expect(xml).toContain("<priority>0.7</priority>");
  });
});
