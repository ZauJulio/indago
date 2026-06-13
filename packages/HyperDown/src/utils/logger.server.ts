import { createRequire } from "node:module";
import type { Writable } from "node:stream";

/**
 * HyperDown Logger
 *
 * Centralized Pino-based logger for the HyperDown package.
 * Provides pre-configured child loggers with colored prefixes
 * for each subsystem (writer, sitemap, sqlite, worker).
 *
 * @module
 */
import pino from "pino";

const isNode = typeof process !== "undefined" && !!process.stdout;

// pino's `transport: { target: "pino-pretty" }` resolves the target module in a
// worker thread at runtime — inside a bundled serverless function (e.g. Vercel)
// that resolution fails and crashes the whole import graph. Load pino-pretty
// directly instead (dev only) and fall back to plain JSON logs.
//
// `createRequire` (sync) rather than `await import(...)`: a top-level await here
// turns this module — and everything that imports it (e.g. the Next adapter at
// `@muttum/hyper-down/next`) — into an async ES module, which Next's CJS
// `require()` of `next.config` cannot load (`ERR_REQUIRE_ASYNC_MODULE`).
let prettyStream: Writable | undefined;
if (isNode && process.env.NODE_ENV !== "production") {
  try {
    const required = createRequire(import.meta.url)("pino-pretty") as {
      default?: (opts: unknown) => Writable;
    } & ((opts: unknown) => Writable);
    const prettyFactory = required.default ?? required;
    prettyStream = prettyFactory({
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    });
  } catch {
    // pino-pretty not available — fall back to JSON output
  }
}

const root = pino(
  isNode
    ? { level: process.env.LOG_LEVEL ?? "info" }
    : /* istanbul ignore next */ {
        level: "info",
        browser: { asObject: true },
      },
  prettyStream,
);

// ─── Child Loggers ───────────────────────────────────────────

/** Database writer operations (CREATE, INSERT, INDEX, compress) */
export const writerLog = root.child({ name: "HyperDown: 💾 writer" });

/** Sitemap generation (scan, generate, write) */
export const sitemapLog = root.child({ name: "HyperDown: 🗺️ sitemap" });

/** SQLite WASM client (init, queries) */
export const sqliteLog = root.child({ name: "HyperDown: 🔌 sqlite" });

/** SQLite Web Worker (cache, deserialize, exec) */
export const workerLog = root.child({ name: "HyperDown: ⚙️ worker" });

/** Content processing (parse, load, process) */
export const contentLog = root.child({ name: "HyperDown: 📄 content" });

/** CLI scripts (init, update, codegen) */
export const scriptLog = root.child({ name: "HyperDown: 📜 scripts" });

/** General / fallback */
export const log = root;

export default root;
