import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { Link } from "@/components/Link";
import { recipeRepository } from "@/content/repositories.server";
import { I18N, localeFromPath } from "@/i18n";

const PAGE_SIZE = 6;

/** SSR: paginated, full-text recipe search driven by the URL query. */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  // `canonical` is the DB tag (`en`/`pt-BR`) the repository filters on
  // (`WHERE locale = ?`).
  const locale = I18N.locales[localeFromPath(url.pathname)].canonical;
  const searchQuery = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const result = await recipeRepository.search({
    locale,
    searchQuery,
    sort: { sortBy: "date", sortDir: "desc" },
    pagination: { page, pageSize: PAGE_SIZE },
  });

  return { ...result, searchQuery };
}

export default function Cooking() {
  const { t } = useTranslation();
  const { results, searchQuery, currentPage, totalPages } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <Link to="/" className="text-sm text-brand-400 no-underline">
        ← {t(($) => $.common.home)}
      </Link>

      <h1 className="mt-4 text-4xl font-bold text-white">{t(($) => $.recipes.title)}</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">{t(($) => $.recipes.description)}</p>

      <form method="get" className="mt-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={searchQuery}
          aria-label={t(($) => $.articles.search)}
          placeholder={t(($) => $.articles.search)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="rounded-lg border border-brand-500 bg-brand-500/10 px-4 py-2 text-brand-300"
        >
          {t(($) => $.articles.searchAction)}
        </button>
      </form>

      {results.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {results.map((recipe) => (
            <Link
              key={recipe.slug}
              to={`/cooking/${recipe.slug}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 no-underline transition-colors hover:border-brand-500"
            >
              <h2 className="text-lg font-semibold text-white">{recipe.title}</h2>
              {recipe.description && (
                <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{recipe.description}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-12 text-zinc-500">{t(($) => $.recipes.empty)}</p>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-4 text-sm">
          {currentPage > 1 && (
            <Link to={`/cooking?page=${currentPage - 1}`} className="text-brand-400 no-underline">
              ← {currentPage - 1}
            </Link>
          )}
          <span className="text-zinc-500">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link to={`/cooking?page=${currentPage + 1}`} className="text-brand-400 no-underline">
              {currentPage + 1} →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
