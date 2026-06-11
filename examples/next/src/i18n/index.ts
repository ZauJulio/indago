import en from "./locales/en.json";
import pt from "./locales/pt.json";

// i18n core — **server-safe** (no React, no react-i18next), so Server Components,
// middleware, and `generateStaticParams`/`generateMetadata` can import the config,
// `Locale`, and the path helpers without pulling client-only code into the RSC
// graph (webpack errors if react-i18next's hooks reach the server bundle). The
// react-i18next instances, `<I18nProvider>`, and `useLocale` live in `./react.tsx`
// ("use client"); they consume the `resources` re-exported below.

/**
 * Per-locale config — the single source of truth for everything locale-shaped.
 * `canonical` is the BCP-47 tag external standards use (the HyperDown SQLite
 * `locale` column, `hreflang`, `<html lang>`); `display` is the `Intl` tag (region
 * on both sides, e.g. `en-US`); `routePrefix` is the URL prefix (the default locale
 * is served prefix-free). Adding a locale = one entry here.
 */
export const I18N = {
  defaultLocale: "en",
  locales: {
    en: { canonical: "en", display: "en-US", routePrefix: "" },
    pt: { canonical: "pt-BR", display: "pt-BR", routePrefix: "/pt" },
  },
} as const;

/** App-facing locales — the macro language code (no region). The region-qualified
 *  tags live in {@link I18N} (`canonical` / `display`). */
export type Locale = keyof typeof I18N.locales;

const localeKeys = Object.keys(I18N.locales) as Locale[];

/** Coerce a dynamic route param (typed `string` by Next's generated route types)
 *  into a valid {@link Locale}, falling back to the default. */
export function toLocale(param: string): Locale {
  return param in I18N.locales ? (param as Locale) : I18N.defaultLocale;
}

/** Derive the active locale from a request/URL pathname. */
export function localeFromPath(pathname: string): Locale {
  for (const locale of localeKeys) {
    const { routePrefix } = I18N.locales[locale];
    if (routePrefix && (pathname === routePrefix || pathname.startsWith(`${routePrefix}/`))) {
      return locale;
    }
  }
  return I18N.defaultLocale;
}

/** Strip the locale prefix to the logical (locale-free) path. */
export function stripLocale(pathname: string): string {
  const { routePrefix } = I18N.locales[localeFromPath(pathname)];
  if (!routePrefix) return pathname;
  return pathname.slice(routePrefix.length) || "/";
}

/** Prepend the locale prefix to a logical path (default locale stays prefix-free). */
export function withLocale(locale: Locale, path: string): string {
  const { routePrefix } = I18N.locales[locale];
  if (!routePrefix) return path;
  return path === "/" ? routePrefix : `${routePrefix}${path}`;
}

/** Translation bundle (plain JSON — server-safe). The client instances in
 *  `./react.tsx` are wired with this; keeping it here avoids duplicating it. */
export const resources = { en: { translation: en }, pt: { translation: pt } } as const;
