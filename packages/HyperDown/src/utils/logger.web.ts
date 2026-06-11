/**
 * HyperDown Browser Logger
 *
 * Lightweight structured logger for browser-side code (Web Workers, client).
 * Mirrors the Pino API surface used in the codebase but uses `console.*`
 * with styled prefixes, since pino requires Node.js runtime.
 *
 * @module
 */

// ─── Types ───────────────────────────────────────────────────

type LogData = Record<string, unknown>;

interface BrowserLogger {
  info: (dataOrMsg: LogData | string, msg?: string) => void;
  warn: (dataOrMsg: LogData | string, msg?: string) => void;
  error: (dataOrMsg: LogData | string, msg?: string) => void;
  debug: (dataOrMsg: LogData | string, msg?: string) => void;
  fatal: (dataOrMsg: LogData | string, msg?: string) => void;
}

// ─── Styles ──────────────────────────────────────────────────

const STYLES = {
  info: "color: #22d3ee; font-weight: bold;",
  warn: "color: #fbbf24; font-weight: bold;",
  error: "color: #f87171; font-weight: bold;",
  debug: "color: #a78bfa; font-weight: bold;",
  fatal: "color: #ff0000; font-weight: bold; text-decoration: underline;",
  reset: "color: inherit; font-weight: normal;",
  data: "color: #6b7280; font-style: italic;",
} as const;

// ─── Factory ─────────────────────────────────────────────────

function createBrowserLogger(prefix: string): BrowserLogger {
  const makeLog =
    (level: keyof typeof STYLES, consoleFn: (...args: unknown[]) => void) =>
    (dataOrMsg: LogData | string, msg?: string) => {
      const tag = `%c[${prefix}]%c`;
      const message = typeof dataOrMsg === "string" ? dataOrMsg : msg || "";
      const data = typeof dataOrMsg === "object" ? dataOrMsg : undefined;

      if (data && Object.keys(data).length > 0) {
        consoleFn(
          `${tag} ${message} %c${JSON.stringify(data)}`,
          STYLES[level],
          STYLES.reset,
          STYLES.data,
        );
      } else {
        consoleFn(`${tag} ${message}`, STYLES[level], STYLES.reset);
      }
    };

  /* oxlint-disable no-console */
  return {
    info: makeLog("info", console.log),
    warn: makeLog("warn", console.warn),
    error: makeLog("error", console.error),
    debug: makeLog("debug", console.debug),
    fatal: makeLog("fatal", console.error),
  };
  /* oxlint-enable no-console */
}

// ─── Child Loggers ───────────────────────────────────────────

/** SQLite WASM client (init, queries) */
export const sqliteLog = createBrowserLogger("HyperDown: 🔌 sqlite");

/** SQLite Web Worker (cache, deserialize, exec) */
export const workerLog = createBrowserLogger("HyperDown: ⚙️  worker");

/** Content hooks (search, distinct values) */
export const hooksLog = createBrowserLogger("HyperDown: 🪝 hooks");
