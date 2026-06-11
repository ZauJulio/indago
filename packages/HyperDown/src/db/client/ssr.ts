import { sqliteLog } from "../../utils/logger.web.ts";

import type { IHyperDownClient, SQLiteBindValue } from "./types.ts";

// ─── Minimal SQLite interface (satisfied by both bun:sqlite and node:sqlite) ──
interface BunStatement {
  all(...args: SQLiteBindValue[]): unknown[];
}
interface BunDB {
  prepare(sql: string): BunStatement;
  close(): void;
}

/**
 * Opens a read-only SQLite DB with the runtime's native driver: `bun:sqlite` under
 * Bun, else `node:sqlite` (Node ≥ 22, e.g. Vercel).
 *
 * The driver is picked by runtime detection, not try/catch fallback — Bun ≤ 1.3.5
 * lacks `node:sqlite`, so a `bun:sqlite` open error must not fall through to it. The
 * specifier is interpolated from a variable + `@vite-ignore` so Vite/Rolldown can't
 * rewrite or statically externalize it; the import stays truly dynamic.
 */
async function openReadonlyDatabase(absolutePath: string): Promise<BunDB> {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  const runtime = isBun ? "bun" : "node";
  const mod = await import(/* @vite-ignore */ `${runtime}:sqlite`);

  if (isBun) {
    return new mod.Database(absolutePath, { readonly: true }) as BunDB;
  }

  return new mod.DatabaseSync(absolutePath, { readOnly: true }) as BunDB;
}

// ─── SSR Client ───────────────────────────────────────────────
export class HyperDownSSRClient implements IHyperDownClient {
  private static instance: HyperDownSSRClient;
  private dbInstances = new Map<string, BunDB>();
  // Compiled-statement cache (dbUrl → SQL); loaders reuse a small, bounded set of
  // query shapes, so this avoids recompiling on every request.
  private stmtCache = new Map<string, Map<string, BunStatement>>();
  // In-flight opens (by dbUrl): concurrent cold requests await the same promise.
  private opening = new Map<string, Promise<BunDB>>();

  private constructor() {}

  public static getInstance(): HyperDownSSRClient {
    if (!HyperDownSSRClient.instance) HyperDownSSRClient.instance = new HyperDownSSRClient();
    return HyperDownSSRClient.instance;
  }

  /** Ensures the collection's DB is open and returns its resolved `dbUrl`. */
  public async init(contentName?: string): Promise<string> {
    const dbUrl = await this.resolveDbUrl(contentName);
    if (this.dbInstances.has(dbUrl)) return dbUrl;

    // Memoize the in-flight open so a second concurrent caller awaits the first's
    // promise instead of racing it (duplicated handle / half-written temp file).
    let pending = this.opening.get(dbUrl);

    if (!pending) {
      pending = this.openDb(dbUrl, contentName);
      this.opening.set(dbUrl, pending);
    }

    try {
      this.dbInstances.set(dbUrl, await pending);
    } finally {
      this.opening.delete(dbUrl);
    }

    return dbUrl;
  }

  /** Resolve the `.db` to an on-disk path (built `metadata/`, `data:` URI, or asset
   *  probe) and open it read-only. */
  private async openDb(dbUrl: string, contentName?: string): Promise<BunDB> {
    const fs = await import("node:fs");
    const path = await import("node:path");

    let absolutePath: string;

    try {
      // Prefer `dist/metadata/<name>.db` (self-contained build output). Skipped in
      // dev so a stale `dist/` never shadows the freshly regenerated source DB.
      const metadataDb =
        contentName && process.env.NODE_ENV !== "development"
          ? [
              path.join(process.cwd(), "dist", "metadata", `${contentName}.db`),
              path.join(process.cwd(), "metadata", `${contentName}.db`),
            ].find((candidate) => fs.existsSync(candidate))
          : undefined;

      if (metadataDb) {
        absolutePath = metadataDb;
      } else if (dbUrl.startsWith("data:")) {
        // Vite inlines small DBs as `data:` URIs; materialize to a temp file so the
        // driver reads it file-based, never in-memory.
        absolutePath = await this.materializeDataUri(dbUrl, contentName ?? "default");
      } else {
        // Probe candidate bases: the same dbUrl must resolve at prerender (cwd = app
        // dir) and at request time (cwd = build/client). First existing wins.
        const rel = dbUrl.replace(/^\//, "");
        const bases = dbUrl.startsWith("/")
          ? [
              path.join(process.cwd(), dbUrl),
              path.join(process.cwd(), "build", "client", rel),
              path.join(process.cwd(), "dist", "client", rel),
              path.join(process.cwd(), "dist", "server", rel),
              path.join(process.cwd(), "client", rel),
            ]
          : [path.resolve(dbUrl)];

        const found = bases.find((candidate) => fs.existsSync(candidate));

        if (!found) {
          throw new Error(`Database file not found for ${dbUrl} (tried ${bases.join(", ")})`);
        }

        absolutePath = found;
      }

      return await openReadonlyDatabase(absolutePath);
    } catch (err) {
      sqliteLog.error({ error: String(err), dbUrl: dbUrl.slice(0, 64) }, "SSR SQLite init failed");
      throw err;
    }
  }

  /**
   * Decode a `data:` URI database to a real temp `.db` file and return its path.
   * Handles gzip-encoded payloads. The file is cached on disk across requests.
   */
  private async materializeDataUri(dbUrl: string, name: string): Promise<string> {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const crypto = await import("node:crypto");

    const comma = dbUrl.indexOf(",");
    const header = dbUrl.slice(5, comma); // e.g. "application/gzip;base64"
    const payload = dbUrl.slice(comma + 1);
    let bytes = Buffer.from(payload, header.includes(";base64") ? "base64" : "utf-8");

    // Gunzip when the media type says gzip or the gzip magic bytes are present.
    if (header.includes("gzip") || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
      const zlib = await import("node:zlib");
      bytes = zlib.gunzipSync(bytes);
    }

    // Stable file name per payload so repeated inits reuse the same file.
    const hash = crypto.createHash("sha1").update(payload).digest("hex").slice(0, 16);
    const target = path.join(os.tmpdir(), `hyperdown-${name}-${hash}.db`);
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);

    return target;
  }

  public async query<T>(
    sql: string,
    bind: SQLiteBindValue[] = [],
    contentName?: string,
  ): Promise<T[]> {
    // `init` resolves the dbUrl and opens the DB once; reuse its result.
    const dbUrl = await this.init(contentName);
    const db = this.dbInstances.get(dbUrl);

    if (!db) throw new Error(`SSR Database not initialized for ${contentName}`);

    try {
      return this.prepared(dbUrl, db, sql).all(...bind) as T[];
    } catch (err) {
      sqliteLog.error({ error: String(err), sql }, "SSR Query failed");
      throw err;
    }
  }

  /** Returns a cached prepared statement for `sql`, compiling it on first use. */
  private prepared(dbUrl: string, db: BunDB, sql: string): BunStatement {
    let cache = this.stmtCache.get(dbUrl);
    if (!cache) {
      cache = new Map();
      this.stmtCache.set(dbUrl, cache);
    }

    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  }

  private async resolveDbUrl(contentName?: string): Promise<string> {
    if (contentName) {
      // Dynamic import so the static graph carries no unresolved `virtual:` import
      // into environments that can't resolve it (e.g. prerender).
      const { getCollectionConfig } = await import("virtual:hyperdown-collections");
      const config = await getCollectionConfig(contentName);
      return config.dbUrl;
    }
    return "default";
  }
}
