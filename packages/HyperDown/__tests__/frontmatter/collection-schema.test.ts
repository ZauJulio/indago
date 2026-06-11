import { describe, expect, test } from "bun:test";

import { CollectionSchema } from "../../src/frontmatter/collection-schema.ts";

import type { FrontmatterField } from "../../src/frontmatter/config.ts";

// Pure SQL/DDL generation from field definitions — no DB, no mocks. These assert
// the exact statements the writer executes, including the tags/categories array
// handling that backs full-text search and the bridge table.

const f = (
  name: string,
  type: string,
  extra: Partial<FrontmatterField> = {},
): FrontmatterField => ({
  title: name,
  name,
  type,
  ...extra,
});

const articleFields: FrontmatterField[] = [
  f("title", "string"),
  f("description", "string"),
  f("date", "datetime"),
  f("draft", "draft"),
  f("tags", "tags"),
  f("categories", "categories"),
  f("difficulty", "choice", { choices: ["easy", "hard"] }),
];

describe("CollectionSchema column + table metadata", () => {
  const schema = new CollectionSchema("article", articleFields);

  test("ftsColumns excludes draft and datetime fields", () => {
    expect(schema.ftsColumns).toEqual(["title", "description", "tags", "categories", "difficulty"]);
  });

  test("arrayFields are exactly the tags + categories fields", () => {
    expect(schema.arrayFields).toEqual(["tags", "categories"]);
  });

  test("hasArrayFields is true when a tags/categories field exists", () => {
    expect(schema.hasArrayFields).toBe(true);
    expect(new CollectionSchema("plain", [f("title", "string")]).hasArrayFields).toBe(false);
  });

  test("isArrayFtsColumn covers BOTH tags AND categories (regression for FTS bind)", () => {
    // Categories used to be excluded here, so its raw array was bound straight
    // into the FTS insert and threw "Binding expected string…". Both must flatten.
    expect(schema.isArrayFtsColumn("tags")).toBe(true);
    expect(schema.isArrayFtsColumn("categories")).toBe(true);
    expect(schema.isArrayFtsColumn("title")).toBe(false);
  });

  test("ftsTable / tagsTable derive from the collection name", () => {
    expect(schema.ftsTable).toBe("article_fts");
    expect(schema.tagsTable).toBe("article_tags");
  });
});

describe("CollectionSchema DDL", () => {
  const schema = new CollectionSchema("article", articleFields);

  test("createTableSql declares id/slug/locale + every field column with UNIQUE(slug,locale)", () => {
    const sql = schema.createTableSql();
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS article ");
    expect(sql).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(sql).toContain("slug TEXT NOT NULL");
    expect(sql).toContain("locale TEXT NOT NULL");
    expect(sql).toContain("draft INTEGER"); // draft → INTEGER
    expect(sql).toContain("title TEXT"); // everything else → TEXT
    expect(sql).toContain("UNIQUE(slug, locale)");
  });

  test("createFtsSql is contentless FTS5 over the fts columns + a body column", () => {
    const sql = schema.createFtsSql();
    expect(sql).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS article_fts ");
    expect(sql).toContain("USING fts5(");
    expect(sql).toContain("title, description, tags, categories, difficulty, body");
    expect(sql).toContain('content=""');
    expect(sql).toContain('tokenize="unicode61"');
  });

  test("createTagsTableSql emits the (content_id, field, value) bridge only with array fields", () => {
    expect(schema.createTagsTableSql()).toContain(
      "CREATE TABLE IF NOT EXISTS article_tags (content_id INTEGER NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL)",
    );
    expect(new CollectionSchema("plain", [f("title", "string")]).createTagsTableSql()).toBeNull();
  });

  test("insertRowSql lists every field with $-placeholders and RETURNING id", () => {
    const sql = schema.insertRowSql();
    expect(sql).toContain(
      "INSERT INTO article (slug, locale, title, description, date, draft, tags, categories, difficulty)",
    );
    expect(sql).toContain(
      "VALUES ($slug, $locale, $title, $description, $date, $draft, $tags, $categories, $difficulty)",
    );
    expect(sql).toContain("RETURNING id;");
  });

  test("insertFtsSql binds rowid + every fts column + body", () => {
    const sql = schema.insertFtsSql();
    expect(sql).toContain(
      "INSERT INTO article_fts (rowid, title, description, tags, categories, difficulty, body)",
    );
    expect(sql).toContain(
      "VALUES ($content_rowid, $title, $description, $tags, $categories, $difficulty, $body)",
    );
  });

  test("insertTagSql targets the bridge table (null without array fields)", () => {
    expect(schema.insertTagSql()).toBe(
      "INSERT INTO article_tags (content_id, field, value) VALUES ($cid, $field, $value);",
    );
    expect(new CollectionSchema("plain", [f("title", "string")]).insertTagSql()).toBeNull();
  });

  test("createIndexSqls: locale+title always, plus (locale,col) per datetime/choice, plus tags bridge", () => {
    const sqls = schema.createIndexSqls();
    expect(sqls).toContain(
      "CREATE INDEX IF NOT EXISTS idx_article_locale_title ON article(locale, title);",
    );
    expect(sqls).toContain(
      "CREATE INDEX IF NOT EXISTS idx_article_locale_date ON article(locale, date);",
    );
    expect(sqls).toContain(
      "CREATE INDEX IF NOT EXISTS idx_article_locale_difficulty ON article(locale, difficulty);",
    );
    expect(sqls).toContain(
      "CREATE INDEX IF NOT EXISTS idx_article_tags ON article_tags(field, value);",
    );
    // No (locale, title) duplicate, no index for plain string/tags columns.
    expect(sqls.some((s) => s.includes("locale_description"))).toBe(false);
  });

  test("a collection with no array fields omits the bridge index", () => {
    const plain = new CollectionSchema("plain", [f("title", "string"), f("date", "datetime")]);
    const sqls = plain.createIndexSqls();
    expect(sqls.some((s) => s.includes("plain_tags"))).toBe(false);
    expect(sqls).toContain(
      "CREATE INDEX IF NOT EXISTS idx_plain_locale_date ON plain(locale, date);",
    );
  });
});
