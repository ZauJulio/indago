import { createFileRoute } from "@tanstack/react-router";

import { CookingView } from "@/features/cooking";
import { toLocale } from "@/i18n";
import { validateListingSearch } from "@/lib/search";
import { fetchRecipes } from "@/server/content";

export const Route = createFileRoute("/{-$locale}/cooking/")({
  validateSearch: validateListingSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, params }) =>
    fetchRecipes({ data: { ...deps, locale: toLocale(params.locale) } }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CookingView data={Route.useLoaderData()} />;
}
