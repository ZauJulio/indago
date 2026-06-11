import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import { I18N, stripLocale, useLocale, withLocale } from "@/i18n";

/** Toggles between the default locale (prefix-free) and `/pt`, preserving the path. */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const logical = stripLocale(useLocation().pathname);
  const target = withLocale(locale === I18N.defaultLocale ? "pt" : I18N.defaultLocale, logical);

  return (
    <Link
      data-testid="lang-switcher"
      to={target}
      className="fixed top-4 right-4 z-50 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 backdrop-blur hover:border-brand-500"
    >
      {t(($) => $.lang.switchTo)}
    </Link>
  );
}
