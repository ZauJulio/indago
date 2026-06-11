import { articleRepository } from "@hyper-down/content/article/builder";

import type { PageContextServer } from "vike/types";

const PAGE_SIZE = 6;

export type Data = Awaited<ReturnType<typeof data>>;

/** SSR/SSG: paginated, full-text article search driven by the URL query. */
export async function data({ localeCan: locale, urlParsed: { search } }: PageContextServer) {
  // `localeCan` is the DB tag (`en`/`pt-BR`) the repository filters on
  // (`WHERE locale = ?`), derived once in +onBeforeRoute.
  const searchQuery = (search.q ?? "").trim();
  const activeTag = search.tag ?? null;
  const page = Math.max(1, Number(search.page) || 1);

  const [result, tags] = await Promise.all([
    articleRepository.search({
      locale,
      searchQuery,
      filters: activeTag ? { tag: activeTag } : {},
      sort: { sortBy: "date", sortDir: "desc" },
      pagination: { page, pageSize: PAGE_SIZE },
    }),
    articleRepository.distinctValues(
      { isJson: true, column: "tags", sortByFrequency: true },
      locale,
    ),
  ]);

  return { ...result, tags, searchQuery, activeTag };
}
