// ─── HyperDown — server-only entry (`@indago/hyper-down/server`) ──────────────
//
// SSR-only: these symbols query SQLite and therefore must run **on the server**
// (route loaders, ideally from a `*.server.ts` module). They are kept out of the
// main (browser-safe) barrel so React Router never pulls the SQLite client into
// a client bundle.

export { ContentRepository } from "./db/repository.ts";
export { createLazyRepository } from "./db/lazy-repository.ts";
export type {
  ContentRepositoryOptions,
  ContentSearchParams,
  DistinctValuesOptions,
  PaginationConfig,
  RelatedParams,
  SearchFilters,
  SearchResult,
  SortConfig,
} from "./db/repository.ts";

export { hyperDownClient } from "./db/client/index.ts";
export type { SQLiteBindValue } from "./db/client/index.ts";
