import { createFileRoute } from "@tanstack/react-router";

import { ArticleView } from "@/features/article";
import { toLocale } from "@/i18n";
import { contentMeta } from "@/lib/seo";
import { fetchArticle } from "@/server/content";

export const Route = createFileRoute("/{-$locale}/articles/$slug")({
  loader: ({ params }) =>
    fetchArticle({ data: { slug: params.slug, locale: toLocale(params.locale) } }),
  head: ({ loaderData }) => ({ meta: contentMeta(loaderData?.article ?? {}) }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ArticleView data={Route.useLoaderData()} />;
}
