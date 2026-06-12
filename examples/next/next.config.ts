import { withHyperDown } from "@muttum/hyper-down/next";
import createMDX from "@next/mdx";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

import type { NextConfig } from "next";

const nextConfig = withHyperDown<NextConfig>({});

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkFrontmatter, remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
});

export default withMDX(nextConfig);
