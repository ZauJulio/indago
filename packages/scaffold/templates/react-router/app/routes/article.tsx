import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { MdxRender } from "@indago/hyper-down";

import { Link } from "@/components/Link";
import { articleRepository } from "@/content/repositories.server";
import { getArticleContent } from "@/content/resolvers";
import { I18N, localeFromPath, useLocale } from "@/i18n";
import { contentMeta } from "@/seo";

/** SSR: article metadata for the detail page (MDX body resolved in the view). */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const locale = localeFromPath(new URL(request.url).pathname);
  // Map the app locale (`en`/`pt`) to the DB tag (`en`/`pt-BR`) the repository filters on.
  const article = await articleRepository.getMetaBySlug(
    params.slug,
    I18N.locales[locale].canonical,
  );
  return { article: article ?? null };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => contentMeta(data?.article ?? {});

export default function Article() {
  const { displayLocale } = useLocale();
  const { t } = useTranslation();
  const { article } = useLoaderData<typeof loader>();

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
