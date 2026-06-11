/** Values accepted as positional bind parameters in a SQLite statement. */
export type SQLiteBindValue = string | number | boolean | null | Uint8Array;

/**
 * Server-side SQLite access contract. Implemented by {@link HyperDownSSRClient},
 * which opens the generated `.db` read-only with `bun:sqlite` / `node:sqlite`.
 */
export interface IHyperDownClient {
  /** Opens the collection's DB (idempotent) and resolves its `dbUrl`. */
  init(contentName?: string): Promise<string>;
  query<T>(sql: string, bind?: SQLiteBindValue[], contentName?: string): Promise<T[]>;
}
