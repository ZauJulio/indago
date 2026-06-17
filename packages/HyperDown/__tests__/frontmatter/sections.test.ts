import { describe, expect, test } from "bun:test";

import { extractSectionRecords, parseSections } from "../../src/frontmatter/sections.ts";

// Pure parsing of a markdown body into the heading tree / FTS records that back
// the composed index and tutorial sidebars. No DB, no mocks.

const doc = `# Intro

Some lead text.

## Getting Started #[beta/#00ff00]

Install the thing.

### **Important** details

Bold subsection body.

## Wrap up

\`\`\`md
## Not a heading (inside a fence)
\`\`\`

Final words.
`;

describe("parseSections", () => {
  test("builds a nested tree by heading level", () => {
    const tree = parseSections(doc);

    expect(tree.map((n) => n.title)).toEqual(["Intro"]);
    const intro = tree[0];
    expect(intro.children.map((n) => n.title)).toEqual(["Getting Started", "Wrap up"]);
    expect(intro.children[0].children.map((n) => n.title)).toEqual(["Important details"]);
  });

  test("anchors are github-slugger slugs (match rehype-slug)", () => {
    const tree = parseSections(doc);
    expect(tree[0].children[0].id).toBe("getting-started");
    expect(tree[0].children[0].children[0].id).toBe("important-details");
  });

  test("extracts `#[label/#color]` badges and strips them from the title", () => {
    const gettingStarted = parseSections(doc)[0].children[0];
    expect(gettingStarted.title).toBe("Getting Started");
    expect(gettingStarted.badges).toEqual([{ label: "beta", color: "#00ff00" }]);
  });

  test("flags bold headings", () => {
    const important = parseSections(doc)[0].children[0].children[0];
    expect(important.bold).toBe(true);
    expect(important.title).toBe("Important details");
  });

  test("ignores `#` lines inside code fences", () => {
    const titles = parseSections(doc).flatMap(function flat(n): string[] {
      return [n.title, ...n.children.flatMap(flat)];
    });
    expect(titles).not.toContain("Not a heading (inside a fence)");
  });
});

describe("extractSectionRecords", () => {
  test("returns one flat record per heading with the body beneath it", () => {
    const records = extractSectionRecords(doc);
    expect(records.map((r) => r.title)).toEqual([
      "Intro",
      "Getting Started",
      "Important details",
      "Wrap up",
    ]);

    const intro = records[0];
    expect(intro.body).toContain("Some lead text.");

    const getting = records[1];
    expect(getting.body).toContain("Install the thing.");
    expect(getting.body).not.toContain("Bold subsection body.");
  });
});
