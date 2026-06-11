// ─── HyperDown hooks / view-layer barrel ─────────────────────────────────────
//
// SSR-only: content is queried server-side via `ContentRepository` (see
// `../db/repository.ts`). The browser-safe helpers here only resolve MDX bodies
// for the metadata a loader already fetched — they never touch the database.

export { createContentResolver } from "./create-content-resolver.ts";
