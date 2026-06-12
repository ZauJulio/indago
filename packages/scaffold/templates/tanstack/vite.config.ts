import { fileURLToPath } from "node:url";

import {
  hyperdownMdxPlugin,
  hyperdownPlugin,
  hyperdownSitemapPlugin,
} from "@muttum/hyper-down/plugins";
import { hyperjsonValidationPlugin } from "@muttum/hyper-json/plugins";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      "@content": r("./content"),
      "@hyper-down": r("./.hyper-down"),
      "@hyper-json": r("./.hyper-json"),
    },
  },
  plugins: [
    // MUST run before the framework/react plugins so `*.mdx?raw` bypass + MDX
    // compile happen first.
    hyperdownMdxPlugin({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    hyperdownPlugin(),
    hyperdownSitemapPlugin(),
    hyperjsonValidationPlugin(),
  ],
  ssr: {
    external: ["pino", "pino-pretty", "bun:sqlite", "node:sqlite"],
    noExternal: ["@muttum/hyper-down"],
  },
  optimizeDeps: {
    exclude: ["@muttum/hyper-down"],
  },
  build: {
    assetsInlineLimit: (filePath: string) => (filePath.endsWith(".db") ? false : undefined),
  },
});
