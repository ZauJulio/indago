import { describe, expect, test } from "bun:test";

import { parseFrontmatter } from "../../src/frontmatter/parser.ts";

// Real YAML front-matter parsing — no mocks.

describe("parseFrontmatter", () => {
  test("splits front-matter from body and coerces YAML scalar types", () => {
    const { data, content } = parseFrontmatter(
      [
        "---",
        "title: Hello",
        "count: 5",
        "draft: true",
        "tags:",
        "  - a",
        "  - b",
        "---",
        "",
        "Body text.",
      ].join("\n"),
    );

    expect(data.title).toBe("Hello");
    expect(data.count).toBe(5); // number, not "5"
    expect(data.draft).toBe(true); // boolean
    expect(data.tags).toEqual(["a", "b"]);
    expect(content.trim()).toBe("Body text.");
  });

  test("returns empty data and the raw input when there is no front-matter", () => {
    const raw = "# Just markdown\n\nno front-matter here";
    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  test("falls back to empty data on invalid YAML, keeping the body", () => {
    const { data, content } = parseFrontmatter("---\ntitle: [unclosed\n---\nBody.");

    expect(data).toEqual({});
    expect(content.trim()).toBe("Body.");
  });
});
