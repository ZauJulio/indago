import { describe, expect, test } from "bun:test";

import { rehypeDropRawHtml } from "../../src/components/rehypeDropRawHtml.ts";

// Real HAST-shaped trees in, mutated trees out — no MDX pipeline, no mocks.

type Node = { type: string; value?: string; children?: Node[] };

function run(tree: Node): Node {
  rehypeDropRawHtml()(tree);
  return tree;
}

describe("rehypeDropRawHtml", () => {
  test("removes top-level {type:'html'} and {type:'raw'} children, keeps the rest", () => {
    const tree = run({
      type: "root",
      children: [
        { type: "element", value: "keep-1" },
        { type: "html", value: "<div>drop</div>" },
        { type: "raw", value: "<!-- drop -->" },
        { type: "text", value: "keep-2" },
      ],
    });

    expect(tree.children?.map((c) => c.type)).toEqual(["element", "text"]);
  });

  test("recurses into kept children and strips nested raw/html", () => {
    const tree = run({
      type: "root",
      children: [
        {
          type: "element",
          children: [
            { type: "text", value: "deep-keep" },
            { type: "html", value: "<span>deep-drop</span>" },
          ],
        },
      ],
    });

    expect(tree.children?.[0].children?.map((c) => c.type)).toEqual(["text"]);
  });

  test("leaves a tree with no raw/html untouched", () => {
    const tree = run({
      type: "root",
      children: [{ type: "element", children: [{ type: "text", value: "x" }] }],
    });
    expect(tree.children?.[0].children?.[0].value).toBe("x");
  });

  test("is a no-op on leaf nodes and primitives", () => {
    expect(() => rehypeDropRawHtml()({ type: "text", value: "leaf" })).not.toThrow();
    expect(() => rehypeDropRawHtml()(null)).not.toThrow();
    expect(() => rehypeDropRawHtml()("string" as unknown)).not.toThrow();
  });
});
