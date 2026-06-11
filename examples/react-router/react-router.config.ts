import type { Config } from "@react-router/dev/config";

// Server-side rendering on. HyperDown is SSR-only (SQLite is read in loaders),
// so `ssr: false` would break the article/recipe sections.
export default {
  ssr: true,
} satisfies Config;
