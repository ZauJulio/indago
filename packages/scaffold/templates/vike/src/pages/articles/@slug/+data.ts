import { articleRepository } from "@hyper-down/content/article/builder";

import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

/** SSR/SSG: article metadata for the detail page (MDX body resolved in the view). */
export async function data({ localeCan: locale, routeParams: { slug } }: PageContextServer) {
  // `localeCan` is the DB tag (`en`/`pt-BR`); the app `locale` (`en`/`pt`) never
  // matches `pt-BR` rows -- it would always fall back to English on /pt.
  return await articleRepository.getMetaBySlug(slug, locale);
}
