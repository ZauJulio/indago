/**
 * Shared URL search-param contract for the listing routes.
 *
 * Every listing route (`/articles`, `/cooking`, in either locale) parses
 * `?q` / `?tag` / `?page` identically, so the shape and its TanStack Router
 * `validateSearch` coercion live here instead of being copy-pasted per route.
 */
export interface ListingSearch {
  q?: string;
  tag?: string;
  page?: number;
}

/** Coerce raw URL search params into a typed {@link ListingSearch}. */
export function validateListingSearch(search: Record<string, unknown>): ListingSearch {
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    tag: typeof search.tag === "string" ? search.tag : undefined,
    page: search.page ? Number(search.page) : undefined,
  };
}
