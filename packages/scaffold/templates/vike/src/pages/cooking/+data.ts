import { recipeRepository } from "@hyper-down/content/recipe/builder";

import type { PageContextServer } from "vike/types";

const PAGE_SIZE = 6;

export type Data = Awaited<ReturnType<typeof data>>;

/**
 * SSR/SSG: paginated, filtered, full-text recipe search + cuisine/meal/course
 * facets driven by the URL query. Each URL change re-runs this hook server-side
 * (live search under the Hono server); the static prerender renders page 1.
 */
export async function data({ localeCan: locale, urlParsed: { search } }: PageContextServer) {
  // `localeCan` is the DB tag (`en`/`pt-BR`) the repository filters on
  // (`WHERE locale = ?`), derived once in +onBeforeRoute.
  const searchQuery = (search.q ?? "").trim();
  const page = Math.max(1, Number(search.page) || 1);

  const [result, cuisines, mealTypes, courseTypes] = await Promise.all([
    recipeRepository.search({
      // FTS matches across every locale; `locale` scopes the returned rows to
      // the active locale (one row per slug).
      locale,
      searchQuery,
      filters: {
        cuisine: search.cuisine,
        mealType: search.mealType,
        courseType: search.courseType,
      },
      sort: { sortBy: "date", sortDir: "desc" },
      pagination: { page, pageSize: PAGE_SIZE },
    }),
    recipeRepository.distinctValues({ column: "cuisine", sortByFrequency: true }, locale),
    recipeRepository.distinctValues({ column: "mealType", sortByFrequency: true }, locale),
    recipeRepository.distinctValues({ column: "courseType", sortByFrequency: true }, locale),
  ]);

  return {
    ...result,
    searchQuery,
    filters: {
      cuisines: ["All", ...cuisines],
      mealTypes: ["All", ...mealTypes],
      courseTypes: ["All", ...courseTypes],
    },
    activeCuisine: search.cuisine ?? "All",
    activeMealType: search.mealType ?? "All",
    activeCourseType: search.courseType ?? "All",
  };
}
