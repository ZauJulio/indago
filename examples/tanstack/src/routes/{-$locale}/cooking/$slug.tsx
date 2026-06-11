import { createFileRoute } from "@tanstack/react-router";

import { RecipeView } from "@/features/recipe";
import { toLocale } from "@/i18n";
import { contentMeta } from "@/lib/seo";
import { fetchRecipe } from "@/server/content";

export const Route = createFileRoute("/{-$locale}/cooking/$slug")({
  loader: ({ params }) =>
    fetchRecipe({ data: { slug: params.slug, locale: toLocale(params.locale) } }),
  head: ({ loaderData }) => ({ meta: contentMeta(loaderData?.recipe ?? {}) }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RecipeView data={Route.useLoaderData()} />;
}
