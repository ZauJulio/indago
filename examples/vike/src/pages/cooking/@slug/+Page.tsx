import { useTranslation } from "react-i18next";

import { MdxRender } from "@muttum/hyper-down";
import { useData } from "vike-react/useData";

import { Link } from "@/components/Link";
import { getRecipeContent } from "@/content/resolvers";

import type { Data } from "./+data";

export default function RecipePage() {
  const { t } = useTranslation();
  const recipe = useData<Data>();

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
