import type { Config } from "vike/types";

// SSR (not prerendered), cascading to the `@slug` detail page — see the articles
// listing's +config.ts for why.
export default {
  prerender: false,
} satisfies Config;
