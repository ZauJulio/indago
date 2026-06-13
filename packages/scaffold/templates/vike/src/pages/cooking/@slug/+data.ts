import { recipeRepository } from "@hyper-down/content/recipe/builder";

import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

/** SSR/SSG: recipe metadata for the detail page (MDX body resolved in the view). */
export async function data({ localeCan: locale, routeParams: { slug } }: PageContextServer) {
  // `localeCan` is the DB tag (`en`/`pt-BR`); the app `locale` (`en`/`pt`) never
  // matches `pt-BR` rows -- it would always fall back to English on /pt.
  return await recipeRepository.getMetaBySlug(slug, locale);
}
