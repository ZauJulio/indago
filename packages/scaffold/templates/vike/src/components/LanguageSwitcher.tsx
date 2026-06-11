import { useTranslation } from "react-i18next";

import { usePageContext } from "vike-react/usePageContext";

import { I18N, stripLocale, withLocale } from "@/i18n";

/** Toggles between the default locale (prefix-free) and `/pt`, preserving the path. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, urlPathnameLocalized } = usePageContext();

  // Strip the current prefix to the logical path, then re-apply the *other*
  // locale's prefix (the default locale is served prefix-free).
  const logical = stripLocale(urlPathnameLocalized ?? "/");
  const target = withLocale(locale === I18N.defaultLocale ? "pt" : I18N.defaultLocale, logical);

  return (
    <a
      data-testid="lang-switcher"
      href={target || "/"}
      className="fixed top-4 right-4 z-50 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 backdrop-blur hover:border-brand-500"
    >
      {t(($) => $.lang.switchTo)}
    </a>
  );
}
