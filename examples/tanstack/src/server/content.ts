import { createServerFn } from "@tanstack/react-start";

import { I18N } from "@/i18n";
import type { Locale } from "@/i18n";

// TanStack route loaders run isomorphically (server during SSR, client during
// navigation). SQLite must never run in the browser, so all reads go through
// these server functions — RPC calls that always execute on the server. The
// repositories (and their node:sqlite import) are loaded lazily inside the
// handlers via `repositories()` so they stay out of the client bundle entirely.

const PAGE_SIZE = 6;

export interface ListParams {
  locale: Locale;
  q?: string;
  tag?: string;
  page?: number;
}

export interface SlugParams {
  locale: Locale;
  slug: string;
}

/** Server-only repositories — dynamically imported to keep SQLite client-side-free. */
const repositories = () => import("@/content/repositories.server");

/** Normalize listing params into a trimmed query + 1-based pagination block. */
function listQuery(data: ListParams) {
  return {
    searchQuery: (data.q ?? "").trim(),
    pagination: { page: Math.max(1, data.page ?? 1), pageSize: PAGE_SIZE },
  };
}

export const fetchArticles = createServerFn({ method: "GET" })
  .validator((data: ListParams) => data)
  .handler(async ({ data }) => {
    const { articleRepository } = await repositories();
    // Map the app's macro locale (`en`/`pt`) to the canonical DB tag (`en`/`pt-BR`).
    const locale = I18N.locales[data.locale].canonical;
    const { searchQuery, pagination } = listQuery(data);
    const [result, tags] = await Promise.all([
      articleRepository.search({
        locale,
        searchQuery,
        filters: data.tag ? { tag: data.tag } : {},
        sort: { sortBy: "date", sortDir: "desc" },
        pagination,
      }),
      articleRepository.distinctValues(
        { isJson: true, column: "tags", sortByFrequency: true },
        locale,
      ),
    ]);
    return { ...result, tags, searchQuery, activeTag: data.tag ?? null };
  });

export const fetchArticle = createServerFn({ method: "GET" })
  .validator((data: SlugParams) => data)
  .handler(async ({ data }) => {
    const { articleRepository } = await repositories();

    const article = await articleRepository.getMetaBySlug(
      data.slug,
      I18N.locales[data.locale].canonical,
    );

    return { article: article ?? null };
  });

export const fetchRecipes = createServerFn({ method: "GET" })
  .validator((data: ListParams) => data)
  .handler(async ({ data }) => {
    const { recipeRepository } = await repositories();
    const { searchQuery, pagination } = listQuery(data);
    const result = await recipeRepository.search({
      locale: I18N.locales[data.locale].canonical,
      searchQuery,
      sort: { sortBy: "date", sortDir: "desc" },
      pagination,
    });

    return { ...result, searchQuery };
  });

export const fetchRecipe = createServerFn({ method: "GET" })
  .validator((data: SlugParams) => data)
  .handler(async ({ data }) => {
    const { recipeRepository } = await repositories();

    const recipe = await recipeRepository.getMetaBySlug(
      data.slug,
      I18N.locales[data.locale].canonical,
    );

    return { recipe: recipe ?? null };
  });
