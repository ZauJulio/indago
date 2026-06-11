// Production server for the TanStack Start build.
//
// `vite build` emits a framework-agnostic fetch handler at
// `dist/server/server.js` (it does not listen on a port itself). srvx wraps that
// handler in a runtime-native HTTP server (Node or Bun).
import { serve } from "srvx";

import handler from "./dist/server/server.js";

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: handler.fetch,
  port,
  hostname: "0.0.0.0",
});

process.stdout.write(`Server listening on http://localhost:${port}\n`);
