import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { MdxRender } from "@muttum/hyper-down";

import { Link } from "@/components/Link";
import { recipeRepository } from "@/content/repositories.server";
import { getRecipeContent } from "@/content/resolvers";
import { localeFromPath } from "@/i18n";
import { contentMeta } from "@/seo";

/** SSR: recipe metadata for the detail page (MDX body resolved in the view). */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const locale = localeFromPath(new URL(request.url).pathname);
  const recipe = await recipeRepository.getMetaBySlug(params.slug, locale);
  return { recipe: recipe ?? null };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => contentMeta(data?.recipe ?? {});

export default function Recipe() {
  const { t } = useTranslation();
  const { recipe } = useLoaderData<typeof loader>();

  if (!recipe) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold text-white">{t(($) => $.recipes.notFound)}</h1>
        <Link to="/cooking" className="mt-6 inline-block text-brand-400">
          ← {t(($) => $.recipes.backTo)}
        </Link>
      </main>
    );
  }

  const Content = getRecipeContent(recipe.slug, recipe.locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/cooking" className="text-sm text-brand-400 no-underline">
        ← {t(($) => $.recipes.backTo)}
      </Link>

      <h1 data-testid="page-title" className="mt-6 text-4xl font-bold text-white">
        {recipe.title}
      </h1>
      {recipe.description && <p className="mt-3 text-lg text-zinc-400">{recipe.description}</p>}

      <article className="mdx-body mt-10 text-zinc-200">
        <MdxRender content={Content} />
      </article>
    </main>
  );
}
