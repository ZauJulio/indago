import { fileURLToPath } from "node:url";

import {
  hyperdownMdxPlugin,
  hyperdownPlugin,
  hyperdownSitemapPlugin,
} from "@indago/hyper-down/plugins";
import { hyperjsonValidationPlugin } from "@indago/hyper-json/plugins";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./app"),
      "@content": r("./content"),
      "@hyper-down": r("./.hyper-down"),
      "@hyper-json": r("./.hyper-json"),
    },
  },
  plugins: [
    // MUST run before reactRouter() so `*.mdx?raw` bypass + MDX compile first.
    hyperdownMdxPlugin({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
    reactRouter(),
    tailwindcss(),
    hyperdownPlugin(),
    hyperdownSitemapPlugin(),
    hyperjsonValidationPlugin(),
  ],
  ssr: {
    external: ["pino", "pino-pretty", "bun:sqlite", "node:sqlite"],
    noExternal: ["@indago/hyper-down"],
  },
  optimizeDeps: {
    exclude: ["@indago/hyper-down"],
  },
  build: {
    assetsInlineLimit: (filePath: string) => (filePath.endsWith(".db") ? false : undefined),
  },
});
