import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Link as RouterLink, useRouterState } from "@tanstack/react-router";

import { I18N, stripLocale, useLocale, withLocale } from "@/i18n";

type RouterTo = ComponentProps<typeof RouterLink>["to"];

/** Toggles between the default locale (prefix-free) and `/pt`, preserving the path. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const next = locale === I18N.defaultLocale ? "pt" : I18N.defaultLocale;
  const target = withLocale(next, stripLocale(pathname));

  return (
    <RouterLink
      to={target as RouterTo}
      data-testid="lang-switcher"
      className="fixed top-4 right-4 z-50 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 backdrop-blur hover:border-brand-500"
    >
      {t(($) => $.lang.switchTo)}
    </RouterLink>
  );
}
