import { SITE_NAME } from "@/seo";

import type { PageContext } from "vike/types";

/** Per-recipe <title> (https://vike.dev/title) — a function of pageContext.data. */
export default function title(pageContext: PageContext): string {
  const recipe = pageContext.data as { title?: string } | undefined;
  return recipe?.title ? `${recipe.title} | ${SITE_NAME}` : SITE_NAME;
}
