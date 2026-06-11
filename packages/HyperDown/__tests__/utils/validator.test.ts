import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { validateConfig } from "../../src/utils/validator.ts";

// Real AJV against the bundled hyperdown.config schema + real frontmatter.json
// cross-validation — no mocks.

let dir: string;

function fullConfig(overrides: Record<string, unknown> = {}) {
  return {
    database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
    sitemap: {
      siteUrl: "https://example.com",
      outputPath: "./public/sitemap.xml",
      staticRoutes: [{ path: "/", priority: "1.0", changefreq: "weekly" }],
      contentTypes: [
        { name: "article", basePath: "/articles", priority: "0.7", changefreq: "monthly" },
      ],
    },
    i18n: { defaultLocale: "en", locales: ["en", "pt-BR"], strategy: "folder", filePattern: {} },
    ...overrides,
  };
}

function write(name: string, data: unknown): string {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(data));
  return p;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hd-cfgvalidator-"));
  // A frontmatter.json declaring the "article" type the sitemap references.
  write("frontmatter.json", {
    "frontMatter.taxonomy.contentTypes": [{ name: "article", fields: [] }],
  });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("validateConfig", () => {
  test("returns the parsed config for a schema-valid file with matching content types", () => {
    const path = write("hyperdown.config.json", fullConfig());
    const cfg = validateConfig(path) as ReturnType<typeof fullConfig>;
    expect(cfg.database.contentDir).toBe("./content");
  });

  test("throws when a required top-level section is missing", () => {
    const { sitemap: _omit, ...noSitemap } = fullConfig();
    const path = write("hyperdown.config.json", noSitemap);
    expect(() => validateConfig(path)).toThrow(/validation failed/i);
  });

  test("throws on an unknown i18n strategy (enum violation)", () => {
    const path = write(
      "hyperdown.config.json",
      fullConfig({
        i18n: { defaultLocale: "en", locales: ["en"], strategy: "magic" },
      }),
    );
    expect(() => validateConfig(path)).toThrow(/validation failed/i);
  });

  test("throws when a sitemap content type is missing from frontmatter.json", () => {
    const path = write(
      "hyperdown.config.json",
      fullConfig({
        sitemap: {
          siteUrl: "https://example.com",
          outputPath: "./public/sitemap.xml",
          staticRoutes: [],
          contentTypes: [
            { name: "ghost", basePath: "/ghost", priority: "0.5", changefreq: "monthly" },
          ],
        },
      }),
    );
    expect(() => validateConfig(path)).toThrow(/missing content type|validation failed/i);
  });

  test("throws when the config file does not exist", () => {
    expect(() => validateConfig(join(dir, "nope.json"))).toThrow();
  });
});
