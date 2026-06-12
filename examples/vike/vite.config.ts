import { fileURLToPath } from "node:url";

import {
  hyperdownMdxPlugin,
  hyperdownPlugin,
  hyperdownSitemapPlugin,
} from "@muttum/hyper-down/plugins";
import { hyperjsonValidationPlugin } from "@muttum/hyper-json/plugins";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import vike from "vike/plugin";
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
    // MUST run before vike()/react() so `*.mdx?raw` bypass + MDX compile first.
    hyperdownMdxPlugin({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
    vike(),
    react(),
    tailwindcss(),
    hyperdownPlugin(),
    hyperdownSitemapPlugin(),
    hyperjsonValidationPlugin(),
  ],
  ssr: {
    // Bundle the engine server code so its virtual:* imports are transformed.
    // Keep SQLite builtins external (lazy SSR search path).
    external: ["pino", "pino-pretty", "bun:sqlite", "node:sqlite"],
    noExternal: ["@muttum/hyper-down"],
  },
  optimizeDeps: {
    exclude: ["@muttum/hyper-down"],
  },
  build: {
    // Never inline the content databases — keep them real assets for SSR loaders.
    assetsInlineLimit: (filePath: string) => (filePath.endsWith(".db") ? false : undefined),
  },
});
