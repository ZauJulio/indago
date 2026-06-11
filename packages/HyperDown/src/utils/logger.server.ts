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

const root = pino(
  isNode
    ? {
        level: process.env.LOG_LEVEL ?? "info",
        // pino loads pino-pretty in a worker thread — never touches the client bundle
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }
    : /* istanbul ignore next */ {
        level: "info",
        browser: { asObject: true },
      },
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
