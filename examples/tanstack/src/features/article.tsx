import { useTranslation } from "react-i18next";

import { MdxRender } from "@virtus/hyper-down";

import { Link } from "@/components/Link";
import { getArticleContent } from "@/content/resolvers";
import { useLocale } from "@/i18n";
import type { fetchArticle } from "@/server/content";

type ArticleData = Awaited<ReturnType<typeof fetchArticle>>;

export function ArticleView({ data }: { data: ArticleData }) {
  const { t } = useTranslation();
  const { displayLocale } = useLocale();
  const { article } = data;

  if (!article) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold text-white">{t(($) => $.articles.notFound)}</h1>
        <Link to="/articles" className="mt-6 inline-block text-brand-400">
          ← {t(($) => $.articles.backTo)}
        </Link>
      </main>
    );
  }

  const Content = getArticleContent(article.slug, article.locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/articles" className="text-sm text-brand-400 no-underline">
        ← {t(($) => $.articles.backTo)}
      </Link>

      <h1 data-testid="page-title" className="mt-6 text-4xl font-bold text-white">
        {article.title}
      </h1>
      {article.description && <p className="mt-3 text-lg text-zinc-400">{article.description}</p>}
      {article.date && (
        <p className="mt-2 text-sm text-zinc-500">
          {new Date(article.date).toLocaleDateString(displayLocale, { timeZone: "UTC" })}
        </p>
      )}

      <article className="mdx-body mt-10 text-zinc-200">
        <MdxRender content={Content} />
      </article>
    </main>
  );
}
