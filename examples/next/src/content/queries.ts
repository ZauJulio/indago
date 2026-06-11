import "server-only";
import { I18N } from "@/i18n";
import type { Locale } from "@/i18n";

import { articleRepository, recipeRepository } from "./repositories.server";

// Server-side data access for the App Router (Server Components). Results are
// plain serializable objects passed as props to the client views.

const PAGE_SIZE = 6;

/** Listing query input: locale scope + URL refinements. */
export interface ListInput {
  locale: Locale;
  q?: string;
  tag?: string;
  page?: number;
}

/** Detail query input: locale scope + slug. */
export interface SlugInput {
  locale: Locale;
  slug: string;
}

/** Normalize a listing input into a trimmed query + 1-based pagination block. */
function listQuery({ q = "", page = 1 }: ListInput) {
  return {
    searchQuery: q.trim(),
    pagination: { page: Math.max(1, page), pageSize: PAGE_SIZE },
  };
}

export async function getArticlesData(input: ListInput) {
  // `canonical` is the DB tag (`en`/`pt-BR`) the repository filters on.
  const locale = I18N.locales[input.locale].canonical;
  const { searchQuery, pagination } = listQuery(input);

  const [result, tags] = await Promise.all([
    articleRepository.search({
      locale,
      searchQuery,
      filters: input.tag ? { tag: input.tag } : {},
      sort: { sortBy: "date", sortDir: "desc" },
      pagination,
    }),
    articleRepository.distinctValues(
      { isJson: true, column: "tags", sortByFrequency: true },
      locale,
    ),
  ]);

  return { ...result, tags, searchQuery, activeTag: input.tag ?? null };
}

export async function getArticleData({ locale, slug }: SlugInput) {
  const article = await articleRepository.getMetaBySlug(slug, I18N.locales[locale].canonical);
  return { article: article ?? null };
}

export async function getRecipesData(input: ListInput) {
  const { searchQuery, pagination } = listQuery(input);
  const result = await recipeRepository.search({
    locale: I18N.locales[input.locale].canonical,
    searchQuery,
    sort: { sortBy: "date", sortDir: "desc" },
    pagination,
  });
  return { ...result, searchQuery };
}

export async function getRecipeData({ locale, slug }: SlugInput) {
  const recipe = await recipeRepository.getMetaBySlug(slug, I18N.locales[locale].canonical);
  return { recipe: recipe ?? null };
}

// Serializable result types for the view components.
export type ArticlesData = Awaited<ReturnType<typeof getArticlesData>>;
export type RecipesData = Awaited<ReturnType<typeof getRecipesData>>;
export type ArticleData = Awaited<ReturnType<typeof getArticleData>>;
export type RecipeData = Awaited<ReturnType<typeof getRecipeData>>;
