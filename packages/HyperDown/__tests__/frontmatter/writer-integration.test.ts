import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { buildFilterEntries, buildFtsQuery } from "../../src/db/repository-sql.ts";
import { cleanup, makeTempProject, runCli } from "../helpers.ts";

// Full data-layer integration with NO mocks: build a real multi-locale SQLite DB
// from real .mdx front-matter via the writer, then exercise the exact query
// shapes ContentRepository issues (FTS across locales, the tags/categories bridge,
// scalar/array facets, single-row slug lookup) against the file with bun:sqlite —
// precisely how an SSR loader reads it.

let dir: string;
let dbPath: string;

function writeItem(lang: string, slug: string, frontmatter: string, body: string): void {
  const folder = join(dir, "content", "recipe", lang);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${slug}.mdx`), `---\n${frontmatter}\n---\n\n${body}\n`);
}

beforeEach(() => {
  dir = makeTempProject();
  dbPath = join(dir, "content", "recipe", "recipe.db");

  // A content type with every interesting field kind: a scalar facet (cuisine,
  // a choice), an array facet (tags) and a SECOND array field (categories) that
  // must also be flattened into FTS.
  writeFileSync(
    join(dir, "frontmatter.json"),
    JSON.stringify({
      "frontMatter.taxonomy.contentTypes": [
        {
          name: "recipe",
          fields: [
            { title: "Title", name: "title", type: "string" },
            { title: "Description", name: "description", type: "string" },
            { title: "Cuisine", name: "cuisine", type: "choice", choices: ["Italian", "Japanese"] },
            { title: "Tags", name: "tags", type: "tags" },
            { title: "Categories", name: "categories", type: "categories" },
          ],
        },
      ],
      "frontMatter.content.pageFolders": [
        {
          title: "Recipes",
          path: "[[workspace]]/content/recipe",
          contentTypes: ["recipe"],
          defaultLocale: "en",
          locales: [
            { title: "English", locale: "en", path: "en" },
            { title: "Português", locale: "pt-BR", path: "pt-BR" },
          ],
        },
      ],
      "frontMatter.content.i18n": [
        { title: "English", locale: "en", path: "en" },
        { title: "Português", locale: "pt-BR", path: "pt-BR" },
      ],
    }),
  );

  writeFileSync(
    join(dir, "hyperdown.config.json"),
    JSON.stringify({
      database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
    }),
  );

  const codegenDir = join(dir, ".hyper-down", "content", "recipe");
  mkdirSync(codegenDir, { recursive: true });
  writeFileSync(
    join(codegenDir, "types.ts"),
    "export type RecipeMeta = Record<string, unknown>;\n",
  );

  // Same slug in both locales — the EN body says "fermentation", the PT body says
  // "fermentacao" (FTS must surface the slug from a term in EITHER locale).
  writeItem(
    "en",
    "pizza",
    "title: Slow Pizza\ndescription: A long rise\ncuisine: Italian\ntags:\n  - dough\n  - vegetarian\ncategories:\n  - Mains",
    "A guide to slow fermentation dough.",
  );
  writeItem(
    "pt-BR",
    "pizza",
    "title: Pizza Lenta\ndescription: Longa fermentacao\ncuisine: Italian\ntags:\n  - massa\ncategories:\n  - Pratos",
    "Um guia de fermentacao lenta.",
  );
  writeItem(
    "en",
    "ramen",
    "title: Tonkotsu Ramen\ndescription: Rich broth\ncuisine: Japanese\ntags:\n  - soup\ncategories:\n  - Mains",
    "Simmer the pork bones for hours.",
  );
  // Title-less file is skipped by the writer.
  writeItem("en", "orphan", "description: no title here", "Body only.");

  const res = runCli(["gen:db", "--path", "hyperdown.config.json"], dir);
  expect(res.exitCode).toBe(0);
});

afterEach(() => cleanup(dir));

describe("generated schema + rows", () => {
  test("inserts only titled items and stores array fields as JSON strings", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .query(
          "SELECT slug, locale, title, cuisine, tags, categories FROM recipe ORDER BY slug, locale",
        )
        .all() as Record<string, string>[];

      expect(rows.map((r) => `${r.slug}/${r.locale}`)).toEqual([
        "pizza/en",
        "pizza/pt-BR",
        "ramen/en",
      ]);
      expect(JSON.parse(rows[0].tags)).toEqual(["dough", "vegetarian"]);
      expect(JSON.parse(rows[0].categories)).toEqual(["Mains"]);
      expect(rows[0].cuisine).toBe("Italian");
    } finally {
      db.close();
    }
  });

  test("the tags bridge holds one row per (content, field, value) for tags AND categories", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const fields = db.query("SELECT DISTINCT field FROM recipe_tags ORDER BY field").all() as {
        field: string;
      }[];
      expect(fields.map((f) => f.field)).toEqual(["categories", "tags"]);

      const pizzaTags = db
        .query(
          `SELECT value FROM recipe_tags t JOIN recipe c ON c.id = t.content_id
           WHERE c.slug = 'pizza' AND c.locale = 'en' AND t.field = 'tags' ORDER BY value`,
        )
        .all() as { value: string }[];
      expect(pizzaTags.map((t) => t.value)).toEqual(["dough", "vegetarian"]);
    } finally {
      db.close();
    }
  });

  test("the contentless FTS table stores no original text (only the index)", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      // A contentless FTS5 table (content="") tokenizes values into the index but
      // never stores them, so reading the columns back yields NULL — proving the
      // 'body/title never stored in SQLite' invariant while search still works.
      const rows = db.query("SELECT title, body FROM recipe_fts").all() as {
        title: string | null;
        body: string | null;
      }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.title === null && r.body === null)).toBe(true);
    } finally {
      db.close();
    }
  });
});

describe("ContentRepository query shapes (run against the real DB)", () => {
  function ftsSlugs(db: Database, query: string): string[] {
    const rows = db
      .query(
        `SELECT DISTINCT slug FROM recipe
         WHERE id IN (SELECT rowid FROM recipe_fts WHERE recipe_fts MATCH ?) ORDER BY slug`,
      )
      .all(buildFtsQuery(query)) as { slug: string }[];
    return rows.map((r) => r.slug);
  }

  test("FTS matches across locales and reaches the body text", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      expect(ftsSlugs(db, "fermentation")).toEqual(["pizza"]); // EN body only
      expect(ftsSlugs(db, "fermentacao")).toEqual(["pizza"]); // PT body only
      expect(ftsSlugs(db, "pork")).toEqual(["ramen"]); // EN body
      expect(ftsSlugs(db, "zzzznope")).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("FTS reaches the categories field (regression: categories flattened into the index)", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      // "Mains" lives only in the categories field of pizza/en and ramen/en.
      expect(ftsSlugs(db, "Mains")).toEqual(["pizza", "ramen"]);
    } finally {
      db.close();
    }
  });

  test("tag filter uses the sargable bridge sub-select", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const [entry] = buildFilterEntries({ tag: "vegetarian" });
      expect(entry).toEqual({ column: "tags", op: "tag", value: "vegetarian" });

      const rows = db
        .query(
          `SELECT slug FROM recipe
           WHERE locale = 'en'
             AND id IN (SELECT content_id FROM recipe_tags WHERE field = ? AND value = ?)`,
        )
        .all(entry.column, entry.value) as { slug: string }[];
      expect(rows.map((r) => r.slug)).toEqual(["pizza"]);
    } finally {
      db.close();
    }
  });

  test("distinctValues — scalar facet (cuisine) grouped per locale", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .query(
          `SELECT cuisine AS value, COUNT(*) AS freq FROM recipe
           WHERE locale = 'en' AND cuisine IS NOT NULL AND cuisine != ''
           GROUP BY cuisine ORDER BY value ASC`,
        )
        .all() as { value: string; freq: number }[];
      expect(rows.map((r) => r.value)).toEqual(["Italian", "Japanese"]);
    } finally {
      db.close();
    }
  });

  test("distinctValues — array facet (tags) from the bridge, per locale", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .query(
          `SELECT t.value AS value, COUNT(*) AS freq
           FROM recipe_tags t JOIN recipe c ON c.id = t.content_id
           WHERE t.field = ? AND c.locale = ? GROUP BY t.value ORDER BY value ASC`,
        )
        .all("tags", "en") as { value: string }[];
      expect(rows.map((r) => r.value)).toEqual(["dough", "soup", "vegetarian"]);
    } finally {
      db.close();
    }
  });

  test("getMetaBySlug — single query fetches both locales for a slug", () => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .query("SELECT locale, title FROM recipe WHERE slug = ? AND locale IN (?, ?)")
        .all("pizza", "pt-BR", "en") as { locale: string; title: string }[];
      const byLocale = Object.fromEntries(rows.map((r) => [r.locale, r.title]));
      expect(byLocale["en"]).toBe("Slow Pizza");
      expect(byLocale["pt-BR"]).toBe("Pizza Lenta");
    } finally {
      db.close();
    }
  });
});
