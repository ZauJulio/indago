import vikeReact from "vike-react/config";

import type { Config } from "vike/types";

// Global Vike configuration inherited by every page (https://vike.dev/config).
const config: Config = {
  title: "create-muttum-app",
  description: "HyperDown + HyperJson starter (Vike).",

  extends: [vikeReact],

  // Prerender to static HTML (SSG); `partial: true` keeps the production server
  // entry (dist/server/index.mjs) so the Hono host can run live `+data` search.
  prerender: { partial: true },

  // Expose the URL-derived locale (+ its canonical/display tags and the
  // locale-prefixed path, set by +onBeforeRoute) to the browser so <Link>, the
  // switcher and date formatting build locale-aware output without recomputing it.
  passToClient: ["locale", "localeCan", "displayLocale", "urlPathnameLocalized"],
};

export default config;
