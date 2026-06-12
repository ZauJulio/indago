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
// that resolution fails and crashes the whole import graph. Import pino-pretty
// directly instead (dev only) and fall back to plain JSON logs.
let prettyStream: Writable | undefined;
if (isNode && process.env.NODE_ENV !== "production") {
  try {
    const mod = await import("pino-pretty");
    prettyStream = mod.default({
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    }) as Writable;
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
