import { initReactI18next } from "react-i18next";
import { useLocation } from "react-router";

import i18next, { type i18n as I18nInstance } from "i18next";

import en from "./locales/en.json";
import pt from "./locales/pt.json";

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

const resources = { en: { translation: en }, pt: { translation: pt } } as const;

// One i18next instance per locale, language fixed at init — SSR-safe (no shared
// mutable `language`, so concurrent server renders never interleave locales).
// Each is wired with `initReactI18next` so `useTranslation()` resolves against it
// (scoped by the `<I18nextProvider>` in `root.tsx`). Resources are inlined and
// Suspense is off, so `t` works synchronously at first render.
function createInstance(lng: Locale): I18nInstance {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng,
    fallbackLng: I18N.defaultLocale,
    resources,
    interpolation: { escapeValue: false }, // React already escapes — avoid double-escaping.
    returnNull: false,
    showSupportNotice: false, // silence i18next v25 Locize promo console.info
    react: { useSuspense: false },
  });
  return instance;
}

/** One ready-to-use i18next instance per locale (language fixed at init). */
export const i18nByLocale: Record<Locale, I18nInstance> = {
  en: createInstance("en"),
  pt: createInstance("pt"),
};

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

/** Request-scoped locale metadata resolved from the current URL. */
export interface LocaleData {
  locale: Locale;
  /** Canonical BCP-47 / DB / `hreflang` tag for the active locale (`en` / `pt-BR`). */
  localeCan: string;
  /** `Intl` display tag for the active locale (`en-US` / `pt-BR`). */
  displayLocale: "en-US" | "pt-BR";
}

/**
 * Resolve the request-scoped locale metadata from the current URL. React Router's
 * `useLocation` is the SSR-safe, request-scoped source of truth. The translator
 * itself comes from `useTranslation()` (react-i18next), scoped by the
 * `<I18nextProvider>` in `root.tsx`.
 */
export function useLocale(): LocaleData {
  const locale = localeFromPath(useLocation().pathname);
  return {
    locale,
    localeCan: I18N.locales[locale].canonical,
    displayLocale: I18N.locales[locale].display,
  };
}
