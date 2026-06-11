import { getRecipeData } from "@/content/queries";
import { RecipeView } from "@/features/recipe";
import { toLocale } from "@/i18n";
import { contentMetadata } from "@/seo";

import type { Metadata } from "next";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { recipe } = await getRecipeData({ locale: toLocale(locale), slug });
  return contentMetadata(recipe ?? {});
}

export default async function Page({ params }: PageProps) {
  const { locale, slug } = await params;
  const data = await getRecipeData({ locale: toLocale(locale), slug });
  return <RecipeView data={data} />;
}
