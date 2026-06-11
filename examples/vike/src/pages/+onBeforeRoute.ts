import { I18N, localeFromPath, stripLocale } from "@/i18n";

import type { PageContext } from "vike/types";

/**
 * i18n routing via locale-stripping (https://vike.dev/i18n): strip the `/pt`
 * prefix, expose the detected `locale`, and route against the prefix-free
 * `urlLogical` so one page tree serves both languages.
 *
 * The region-qualified locale tags are derived **here, once**, and passed through
 * pageContext instead of being recomputed in every component: `localeCan` is the
 * canonical BCP-47 / DB / `hreflang` tag (`en` / `pt-BR`); `displayLocale` is the
 * `Intl` display tag (`en-US` / `pt-BR`), which needs the region on both sides.
 */
export function onBeforeRoute(pageContext: PageContext) {
  const { urlPathname } = pageContext;

  // `urlLogical` MUST keep the query: Vike re-parses `urlParsed` from it, so a
  // pathname-only value would drop `?q=` and break the URL-driven loaders.
  const { searchOriginal } = pageContext.urlParsed;

  const locale = localeFromPath(urlPathname);

  return {
    pageContext: {
      locale,
      localeCan: I18N.locales[locale].canonical,
      displayLocale: I18N.locales[locale].display,
      urlPathnameLocalized: urlPathname,
      urlLogical: `${stripLocale(urlPathname)}${searchOriginal ?? ""}`,
    },
  };
}
