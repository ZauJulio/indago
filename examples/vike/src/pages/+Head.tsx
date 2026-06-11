import { usePageContext } from "vike-react/usePageContext";

import { I18N, stripLocale, type Locale } from "@/i18n";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/seo";

const ORIGIN = SITE_URL.replace(/\/$/, "");
const LOCALES = Object.keys(I18N.locales) as Locale[];

/** Absolute (or root-relative when `SITE_URL` is unset) URL for `path` in `locale`. */
function urlFor(locale: Locale, path: string): string {
  const prefix = I18N.locales[locale].routePrefix;
  const localized = path === "/" ? prefix || "/" : `${prefix}${path}`;
  return `${ORIGIN}${localized}`;
}

/**
 * Site-wide <head> tags rendered into every page (https://vike.dev/Head).
 * `title` + `description` come from each route's +config; this adds the SEO /
 * Open Graph / Twitter defaults, the favicon, and the per-page canonical +
 * hreflang alternates. Detail pages add their own per-resource OG via a
 * route-level +Head.
 */
export default function HeadDefault() {
  const pageContext = usePageContext();
  const locale = (pageContext.locale ?? I18N.defaultLocale) as Locale;
  const logicalPath = stripLocale(pageContext.urlPathname);
  const canonical = urlFor(locale, logicalPath);

  return (
    <>
      <meta name="robots" content="index, follow" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={SITE_NAME} />
      <meta property="og:description" content={SITE_DESCRIPTION} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={locale === "pt" ? "pt_BR" : "en_US"} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={SITE_NAME} />
      <meta name="twitter:description" content={SITE_DESCRIPTION} />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

      {/* Per-page canonical + hreflang alternates (region tags via I18N.canonical). */}
      <link rel="canonical" href={canonical} />
      {LOCALES.map((l) => (
        <link
          key={l}
          rel="alternate"
          hrefLang={I18N.locales[l].canonical}
          href={urlFor(l, logicalPath)}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={urlFor(I18N.defaultLocale, logicalPath)} />
    </>
  );
}
