import { I18nextProvider } from "react-i18next";
import type { MetaFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { i18nByLocale, I18N, localeFromPath, stripLocale, type Locale } from "@/i18n";
import { siteMeta } from "@/seo";
import "@/app.css";

const ORIGIN = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(/\/$/, "");
const LOCALES = Object.keys(I18N.locales) as Locale[];

/** Absolute (or root-relative when `VITE_SITE_URL` is unset) URL for `path` in `locale`. */
function urlFor(locale: Locale, path: string): string {
  const prefix = I18N.locales[locale].routePrefix;
  const localized = path === "/" ? prefix || "/" : `${prefix}${path}`;
  return `${ORIGIN}${localized}`;
}

/** Site-wide SEO / Open Graph defaults; detail routes override via their own `meta`. */
export const meta: MetaFunction = () => siteMeta();

export function Layout({ children }: { children: React.ReactNode }) {
  // The locale is derived from the URL on every render — SSR-safe and request
  // scoped. It selects the matching react-i18next instance for the subtree, so
  // `useTranslation()` resolves the right language without a mutable singleton.
  const pathname = useLocation().pathname;
  const logicalPath = stripLocale(pathname);
  const locale = localeFromPath(pathname);

  return (
    <html lang={I18N.locales[locale].canonical}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Per-page hreflang alternates (region tags via I18N.canonical). */}
        {LOCALES.map((l) => (
          <link
            key={l}
            rel="alternate"
            hrefLang={I18N.locales[l].canonical}
            href={urlFor(l, logicalPath)}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href={urlFor(I18N.defaultLocale, logicalPath)} />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18nByLocale[locale]}>
          <LanguageSwitcher />
          {children}
        </I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
