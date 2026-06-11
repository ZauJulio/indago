import mdx from "@mdx-js/rollup";

import { rehypeDropRawHtml } from "../components/rehypeDropRawHtml.ts";

import type { Plugin } from "vite";

export interface HyperdownMdxOptions {
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
}

export function hyperdownMdxPlugin({
  remarkPlugins = [],
  rehypePlugins = [],
}: HyperdownMdxOptions = {}): Plugin {
  return {
    enforce: "pre",
    ...(mdx({
      remarkPlugins,
      rehypePlugins: [...rehypePlugins, rehypeDropRawHtml],
      jsxImportSource: "react",
    }) as object),
  } as Plugin;
}
