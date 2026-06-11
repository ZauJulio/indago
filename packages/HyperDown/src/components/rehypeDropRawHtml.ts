// Strips {type:'html'} and {type:'raw'} nodes emitted by remark-rehype before
// the MDX compiler processes them. Without this, @mdx-js/rollup calls
// hast-util-raw internally which cannot handle mdxJsxFlowElement siblings
// (e.g. from remark-math wrapping KaTeX blocks).
export function rehypeDropRawHtml() {
  return (tree: unknown) => {
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;

      const n = node as Record<string, unknown>;

      if (Array.isArray(n.children)) {
        n.children = n.children.filter((child: unknown) => {
          if (!child || typeof child !== "object") return true;

          const c = child as Record<string, unknown>;
          if (c.type === "html" || c.type === "raw") return false;

          visit(child);
          return true;
        });
      }
    };
    visit(tree);
  };
}
