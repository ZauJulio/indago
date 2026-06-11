import type { Config } from "vike/types";

// SSR (not prerendered), cascading to the `@slug` detail page: the listing reads
// `?q`/`?tag`/`?page` from the URL and runs `+data` server-side per request
// (live full-text search). Keeping a non-prerendered page in the build is also
// what preserves the production SSR server entry (dist/server/index.mjs).
export default {
  prerender: false,
} satisfies Config;
