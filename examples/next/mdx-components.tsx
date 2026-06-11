import type { MDXComponents } from "mdx/types";

// Required by @next/mdx (App Router). Returns the component overrides used when
// rendering MDX; the defaults are fine for this starter.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
