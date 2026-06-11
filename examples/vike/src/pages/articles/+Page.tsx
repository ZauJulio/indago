import { useTranslation } from "react-i18next";

import { useData } from "vike-react/useData";

import { Link } from "@/components/Link";

import type { Data } from "./+data";

export default function ArticlesPage() {
  const { t } = useTranslation();
  const { results, tags, activeTag, searchQuery, currentPage, totalPages } = useData<Data>();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <Link to="/" className="text-sm text-brand-400 no-underline">
        ← {t(($) => $.common.home)}
      </Link>

      <h1 className="mt-4 text-4xl font-bold text-white">{t(($) => $.articles.title)}</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">{t(($) => $.articles.description)}</p>

      {/* GET form keeps search SSR-friendly: it re-runs +data server-side. */}
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

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/articles"
            className={`rounded-full border px-3 py-1 text-xs no-underline ${
              activeTag ? "border-zinc-700 text-zinc-400" : "border-brand-500 text-brand-300"
            }`}
          >
            #all
          </Link>
          {tags.slice(0, 8).map((tag) => (
            <Link
              key={tag}
              to={`/articles?tag=${encodeURIComponent(tag)}`}
              className={`rounded-full border px-3 py-1 text-xs no-underline ${
                activeTag === tag
                  ? "border-brand-500 text-brand-300"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {results.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {results.map((article) => (
            <Link
              key={article.slug}
              to={`/articles/${article.slug}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 no-underline transition-colors hover:border-brand-500"
            >
              <h2 className="text-lg font-semibold text-white">{article.title}</h2>
              {article.description && (
                <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{article.description}</p>
              )}
              <span className="mt-3 inline-block text-sm text-brand-400">
                {t(($) => $.articles.readMore)} →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-12 text-zinc-500">{t(($) => $.articles.empty)}</p>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-4 text-sm">
          {currentPage > 1 && (
            <Link to={`/articles?page=${currentPage - 1}`} className="text-brand-400 no-underline">
              ← {currentPage - 1}
            </Link>
          )}
          <span className="text-zinc-500">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link to={`/articles?page=${currentPage + 1}`} className="text-brand-400 no-underline">
              {currentPage + 1} →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
