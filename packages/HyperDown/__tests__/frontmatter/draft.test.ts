import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { draftFieldNames, isDraftData, isDraftValue } from "../../src/frontmatter/draft.ts";
import { cleanup, makeTempProject, runCli } from "../helpers.ts";

describe("draft helpers", () => {
  test("draftFieldNames selects the fields whose type is 'draft'", () => {
    expect(
      draftFieldNames([
        { name: "title", type: "string" },
        { name: "wip", type: "draft" },
        { name: "hidden", type: "draft" },
      ]),
    ).toEqual(["wip", "hidden"]);
  });

  test("isDraftValue is true only for true / 'true'", () => {
    expect(isDraftValue(true)).toBe(true);
    expect(isDraftValue("true")).toBe(true);
    expect(isDraftValue(false)).toBe(false);
    expect(isDraftValue("false")).toBe(false);
    expect(isDraftValue(undefined)).toBe(false);
  });

  test("isDraftData is true when ANY configured draft field is truthy", () => {
    expect(isDraftData({ draft: true }, ["draft"])).toBe(true);
    expect(isDraftData({ draft: false }, ["draft"])).toBe(false);
    expect(isDraftData({ a: false, b: true }, ["a", "b"])).toBe(true);
    expect(isDraftData({ draft: true }, [])).toBe(false); // no draft field configured
  });
});

describe("draft exclusion (end to end via gen:db)", () => {
  let dir: string;
  const write = (lang: string, slug: string, fm: string, body: string) => {
    const folder = join(dir, "content", "article", lang);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${slug}.mdx`), `---\n${fm}\n---\n\n${body}\n`);
  };

  beforeEach(() => {
    dir = makeTempProject();

    writeFileSync(
      join(dir, "frontmatter.json"),
      JSON.stringify({
        "frontMatter.taxonomy.contentTypes": [
          {
            name: "article",
            fields: [
              { title: "Title", name: "title", type: "string" },
              { title: "Draft", name: "draft", type: "draft" },
            ],
          },
        ],
        "frontMatter.content.pageFolders": [
          {
            title: "Articles",
            path: "[[workspace]]/content/article",
            contentTypes: ["article"],
            defaultLocale: "en",
          },
        ],
      }),
    );
    writeFileSync(
      join(dir, "hyperdown.config.json"),
      JSON.stringify({
        database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
      }),
    );

    write("en", "published", "title: Published\ndraft: false", "Visible body about pizza.");
    write("en", "secret", "title: Secret WIP\ndraft: true", "Unpublished body about pizza.");

    expect(runCli(["gen:db", "--path", "hyperdown.config.json"], dir).exitCode).toBe(0);
  });

  afterEach(() => cleanup(dir));

  test("the draft body is negated out of the import.meta.glob (never compiled into the bundle)", () => {
    const modules = readFileSync(
      join(dir, ".hyper-down", "content", "article", "modules.ts"),
      "utf-8",
    );
    expect(modules).toContain('"/content/article/**/*.mdx"');
    expect(modules).toContain('"!/content/article/en/secret.mdx"');
    // The published item is matched by the glob, never listed/negated explicitly.
    expect(modules).not.toContain("published.mdx");
  });

  test("the draft item is absent from the SQLite index", () => {
    const db = new Database(join(dir, "content", "article", "article.db"), { readonly: true });
    try {
      const slugs = (
        db.query("SELECT slug FROM article ORDER BY slug").all() as { slug: string }[]
      ).map((r) => r.slug);
      expect(slugs).toEqual(["published"]);

      // And the draft's body text is not reachable through FTS.
      const hits = db
        .query("SELECT rowid FROM article_fts WHERE article_fts MATCH 'pizza'")
        .all() as unknown[];
      expect(hits.length).toBe(1); // only the published item
    } finally {
      db.close();
    }
  });
});
