import vike from "@vikejs/hono";
import { Hono } from "hono";

import type { Server } from "vike/types";

// Hono host for the Vike app (https://vike.dev/hono). SSG covers most routes;
// when this server runs, Vike re-runs each page's `+data` hook server-side on
// navigation — the live SSR search powering the listing pages.
const app = new Hono();
vike(app);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

export default {
  fetch: app.fetch,
  prod: { port },
} satisfies Server;
