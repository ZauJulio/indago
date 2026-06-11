import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanup, makeTempProject, runCli } from "../helpers.ts";

// End-to-end: the `gen:db` CLI turns real .mdx front-matter into a real SQLite
// database with a contentless FTS5 index. We assert against the actual file
// using bun:sqlite — exactly how an SSR loader reads it. No mocks.

let dir: string;

function writeItem(slug: string, frontmatter: string): void {
  writeFileSync(
    join(dir, "content", "article", "en", `${slug}.mdx`),
    `---\n${frontmatter}\n---\n\nBody of ${slug}.\n`,
  );
}

beforeEach(() => {
  dir = makeTempProject();

  // Scaffold a content type + its locale folders.
  runCli(["create-frontmatter", "--name", "article", "--content-dir", "content"], dir);

  // Minimal config pointing the writer at ./content.
  writeFileSync(
    join(dir, "hyperdown.config.json"),
    JSON.stringify({
      database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
    }),
  );

  // The writer gates on the codegen'd types.ts existing (it does not read it);
  // the Vite plugin emits this during a build, so we create it directly here.
  const codegenDir = join(dir, ".hyper-down", "content", "article");
  mkdirSync(codegenDir, { recursive: true });
  writeFileSync(
    join(codegenDir, "types.ts"),
    "export type ArticleMeta = Record<string, unknown>;\n",
  );

  writeItem(
    "numba-guide",
    "title: Numba Acceleration Guide\ndescription: Speeding up loops\ntags:\n  - performance\n  - python",
  );
  writeItem("pizza", "title: Slow Fermentation Pizza\ndescription: Cooking notes\ntags:\n  - food");
  // No title → the writer must skip this file.
  writeItem("draft-no-title", "description: orphan without a title");
});

afterEach(() => cleanup(dir));

describe("hyperdown gen:db", () => {
  test("generates a SQLite database and indexes only titled items", () => {
    const res = runCli(["gen:db", "--path", "hyperdown.config.json"], dir);
    expect(res.exitCode).toBe(0);

    const db = new Database(join(dir, "content", "article", "article.db"), { readonly: true });
    try {
      const rows = db
        .query("SELECT slug, locale, title, tags FROM article ORDER BY slug")
        .all() as {
        slug: string;
        locale: string;
        title: string;
        tags: string;
      }[];

      // 2 titled items inserted; the title-less file was skipped.
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.slug)).toEqual(["numba-guide", "pizza"]);
      expect(rows.every((r) => r.locale === "en")).toBe(true);

      // tags are stored as a JSON array string (rows are sorted by slug).
      const numba = rows[0];
      expect(numba.slug).toBe("numba-guide");
      expect(JSON.parse(numba.tags)).toEqual(["performance", "python"]);
    } finally {
      db.close();
    }
  });

  test("the contentless FTS5 index answers full-text queries", () => {
    runCli(["gen:db", "--path", "hyperdown.config.json"], dir);

    const db = new Database(join(dir, "content", "article", "article.db"), { readonly: true });
    try {
      const hits = db
        .query(
          "SELECT a.slug FROM article a JOIN article_fts f ON a.id = f.rowid WHERE article_fts MATCH ?",
        )
        .all("numba") as { slug: string }[];

      expect(hits.map((h) => h.slug)).toEqual(["numba-guide"]);

      // A term from the other item resolves to that item only.
      const pizzaHits = db
        .query(
          "SELECT a.slug FROM article a JOIN article_fts f ON a.id = f.rowid WHERE article_fts MATCH ?",
        )
        .all("fermentation") as { slug: string }[];
      expect(pizzaHits.map((h) => h.slug)).toEqual(["pizza"]);
    } finally {
      db.close();
    }
  });
});
