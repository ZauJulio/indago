import { SITE_NAME } from "@/seo";

import type { PageContext } from "vike/types";

/** Per-article <title> (https://vike.dev/title) — a function of pageContext.data. */
export default function title(pageContext: PageContext): string {
  const article = pageContext.data as { title?: string } | undefined;
  return article?.title ? `${article.title} | ${SITE_NAME}` : SITE_NAME;
}
