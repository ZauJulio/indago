import { recipeRepository } from "@hyper-down/content/recipe/builder";

import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

/** SSR/SSG: recipe metadata for the detail page (MDX body resolved in the view). */
export async function data({ locale, routeParams: { slug } }: PageContextServer) {
  return await recipeRepository.getMetaBySlug(slug, locale);
}
