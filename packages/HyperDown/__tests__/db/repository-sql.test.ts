import { describe, expect, test } from "bun:test";

import {
  buildFilterEntries,
  buildFtsQuery,
  buildRelatedQuery,
  parseJsonFields,
  toMetaItem,
} from "../../src/db/repository-sql.ts";

// Pure SQL/row helpers that back ContentRepository — exercised with real inputs.

describe("buildFtsQuery", () => {
  test("turns each word into a prefix term joined by AND", () => {
    expect(buildFtsQuery("foo bar")).toBe('"foo"* AND "bar"*');
  });

  test("trims and collapses surrounding whitespace", () => {
    expect(buildFtsQuery("  spaced   out  ")).toBe('"spaced"* AND "out"*');
  });

  test("escapes embedded double quotes", () => {
    expect(buildFtsQuery('a"b')).toBe('"a""b"*');
  });
});

describe("buildFilterEntries", () => {
  test("keeps real filters and drops empty/All/undefined", () => {
    expect(
      buildFilterEntries({
        cuisine: "Italian",
        mealType: "All",
        courseType: "",
        missing: undefined,
      }),
    ).toEqual([{ column: "cuisine", op: "eq", value: "Italian" }]);
  });

  test("maps `tag` to an indexed bridge-table membership on the tags field", () => {
    expect(buildFilterEntries({ tag: "react" })).toEqual([
      { column: "tags", op: "tag", value: "react" },
    ]);
  });
});

describe("buildRelatedQuery", () => {
  test("ranks by tag priority, excludes the source slug, scopes to locale", () => {
    const { sql, bind } = buildRelatedQuery({
      table: "article",
      slug: "current",
      tags: ["A", "B", "C"],
      field: "tags",
      locale: "en",
      limit: 3,
    });

    expect(sql).toContain("MIN(CASE t.value WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 END)");
    expect(sql).toContain("JOIN article_tags t ON t.content_id = c.id");
    expect(sql).toContain("t.value IN (?, ?, ?)");
    expect(sql).toContain("c.slug != ?");
    expect(sql).toContain("c.locale = ?");
    expect(sql).toContain("GROUP BY c.id ORDER BY _rank ASC, c.date DESC LIMIT ?");

    // CASE tags → field → IN tags → slug → locale → limit (left-to-right `?` order).
    expect(bind).toEqual(["A", "B", "C", "tags", "A", "B", "C", "current", "en", 3]);
  });

  test("omits the locale predicate when no locale is given", () => {
    const { sql, bind } = buildRelatedQuery({
      table: "recipe",
      slug: "s",
      tags: ["x"],
      field: "tags",
      limit: 2,
    });

    expect(sql).not.toContain("c.locale = ?");
    expect(bind).toEqual(["x", "tags", "x", "s", 2]);
  });
});

describe("parseJsonFields", () => {
  test("revives JSON-array strings, leaving scalars untouched", () => {
    const out = parseJsonFields({ tags: '["a","b"]', title: "Hello", n: "5" }) as Record<
      string,
      unknown
    >;
    expect(out).toEqual({ tags: ["a", "b"], title: "Hello", n: "5" });
  });

  test("keeps malformed JSON strings as-is", () => {
    expect(parseJsonFields({ tags: "[oops" }) as Record<string, unknown>).toEqual({
      tags: "[oops",
    });
  });
});

describe("toMetaItem", () => {
  test("strips internal columns and parses JSON fields", () => {
    const meta = toMetaItem({
      _total_count: 9,
      content: "body",
      slug: "s",
      locale: "en",
      tags: '["x"]',
    }) as unknown as Record<string, unknown>;
    expect(meta).toEqual({ slug: "s", locale: "en", tags: ["x"] });
  });

  test("leaves a row without internal columns untouched (beyond JSON parsing)", () => {
    const meta = toMetaItem({ slug: "s", title: "T" }) as unknown as Record<string, unknown>;
    expect(meta).toEqual({ slug: "s", title: "T" });
  });

  test("strips the related-query `_rank` ranking column", () => {
    const meta = toMetaItem({ slug: "s", title: "T", _rank: 0 }) as unknown as Record<
      string,
      unknown
    >;
    expect(meta).toEqual({ slug: "s", title: "T" });
  });
});

describe("edge cases", () => {
  test("buildFtsQuery on empty / whitespace input yields an empty string", () => {
    expect(buildFtsQuery("")).toBe("");
    expect(buildFtsQuery("   ")).toBe("");
  });

  test("buildFilterEntries returns [] when every value is empty/All/undefined", () => {
    expect(buildFilterEntries({ a: "", b: "All", c: undefined })).toEqual([]);
  });

  test("buildFilterEntries keeps multiple real filters in insertion order", () => {
    expect(buildFilterEntries({ cuisine: "Italian", mealType: "Dinner" })).toEqual([
      { column: "cuisine", op: "eq", value: "Italian" },
      { column: "mealType", op: "eq", value: "Dinner" },
    ]);
  });

  test("parseJsonFields revives JSON-object strings too", () => {
    const out = parseJsonFields({ meta: '{"a":1}', plain: "{not json" }) as Record<string, unknown>;
    expect(out.meta).toEqual({ a: 1 });
    expect(out.plain).toBe("{not json");
  });
});
