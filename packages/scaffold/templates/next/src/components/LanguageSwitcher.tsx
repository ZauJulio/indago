"use client";

import { useTranslation } from "react-i18next";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { I18N, stripLocale, withLocale } from "@/i18n";
import { useLocale } from "@/i18n/react";

/** Toggles between the default locale (prefix-free) and `/pt`, preserving the path. */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const target = withLocale(
    locale === I18N.defaultLocale ? "pt" : I18N.defaultLocale,
    stripLocale(usePathname()),
  );

  return (
    <NextLink
      data-testid="lang-switcher"
      href={target}
      className="fixed top-4 right-4 z-50 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 backdrop-blur hover:border-brand-500"
    >
      {t(($) => $.lang.switchTo)}
    </NextLink>
  );
}
