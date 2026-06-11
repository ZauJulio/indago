import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { usePageContext } from "vike-react/usePageContext";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { i18nByLocale, I18N, type Locale } from "@/i18n";
import "@/root.css";

/**
 * App shell. vike-react owns the document; this wraps the page with the language
 * switcher. The request locale (set by `+onBeforeRoute`, passed to the client)
 * selects the matching react-i18next instance, so `useTranslation()` resolves the
 * right language under both SSG prerender and client hydration.
 */
export default function LayoutDefault({ children }: { children: ReactNode }) {
  const { locale = I18N.defaultLocale } = usePageContext();

  return (
    <I18nextProvider i18n={i18nByLocale[locale as Locale]}>
      <LanguageSwitcher />
      {children}
    </I18nextProvider>
  );
}
