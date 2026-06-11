import { createFileRoute } from "@tanstack/react-router";

import { ArticlesView } from "@/features/articles";
import { toLocale } from "@/i18n";
import { validateListingSearch } from "@/lib/search";
import { fetchArticles } from "@/server/content";

export const Route = createFileRoute("/{-$locale}/articles/")({
  validateSearch: validateListingSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, params }) =>
    fetchArticles({ data: { ...deps, locale: toLocale(params.locale) } }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ArticlesView data={Route.useLoaderData()} />;
}
