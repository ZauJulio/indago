import { I18nextProvider } from "react-i18next";

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18N, i18nByLocale, localeFromPath, stripLocale, withLocale, type Locale } from "@/i18n";
import { SITE_NAME, siteMeta } from "@/lib/seo";
import appCss from "@/styles.css?url";

const ORIGIN = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(/\/$/, "");
const LOCALES = Object.keys(I18N.locales) as Locale[];

/** Absolute (or root-relative when `VITE_SITE_URL` is unset) URL for `path` in `locale`. */
function urlFor(locale: Locale, path: string): string {
  return `${ORIGIN}${withLocale(locale, path)}`;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_NAME },
      ...siteMeta(),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  // Locale derived from the URL on every render — SSR-safe, request scoped.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locale = localeFromPath(pathname);
  const logicalPath = stripLocale(pathname);

  return (
    <html lang={I18N.locales[locale].canonical}>
      <head>
        <HeadContent />
        {/* Per-page hreflang alternates (region tags via I18N canonical). */}
        {LOCALES.map((l) => (
          <link
            key={l}
            rel="alternate"
            hrefLang={I18N.locales[l].canonical}
            href={urlFor(l, logicalPath)}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href={urlFor(I18N.defaultLocale, logicalPath)} />
      </head>
      <body>
        {/* Scope react-i18next to the request's locale instance (language fixed at init). */}
        <I18nextProvider i18n={i18nByLocale[locale]}>
          <LanguageSwitcher />
          <Outlet />
        </I18nextProvider>
        <Scripts />
      </body>
    </html>
  );
}
