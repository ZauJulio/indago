"use client";

import type { ReactNode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

import i18next, { type i18n as I18nInstance } from "i18next";
import { usePathname } from "next/navigation";

import { I18N, localeFromPath, resources, type Locale } from "./index";

// Client-side i18n. This module is the **only** react-i18next entry point, kept
// out of the server graph so RSC stays clean (the core in `./index` is server-safe).
// The locale lives in the URL (the `[locale]` segment; the public path is preserved
// by the middleware rewrite), so `usePathname()` is the request-scoped source of
// truth and `useTranslation()` resolves against the instance from <I18nProvider>.

// One i18next instance per locale, language fixed at init — no shared mutable
// `language`. Each is wired with `initReactI18next` so `useTranslation()` resolves
// against it (scoped by <I18nProvider>). Resources are inlined and Suspense is off,
// so `t` works synchronously at first render.
function createInstance(lng: Locale): I18nInstance {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng,
    fallbackLng: I18N.defaultLocale,
    resources,
    interpolation: { escapeValue: false }, // React already escapes — avoid double-escaping.
    returnNull: false,
    react: { useSuspense: false },
  });
  return instance;
}

const i18nByLocale: Record<Locale, I18nInstance> = {
  en: createInstance("en"),
  pt: createInstance("pt"),
};

/** Scopes the subtree to the react-i18next instance for `locale` (used in the layout). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nextProvider i18n={i18nByLocale[locale]}>{children}</I18nextProvider>;
}

/** Read the active locale + its region tags from the current pathname. */
export function useLocale(): {
  locale: Locale;
  canonical: string;
  displayLocale: (typeof I18N)["locales"][Locale]["display"];
} {
  const locale = localeFromPath(usePathname());
  return {
    locale,
    canonical: I18N.locales[locale].canonical,
    displayLocale: I18N.locales[locale].display,
  };
}
