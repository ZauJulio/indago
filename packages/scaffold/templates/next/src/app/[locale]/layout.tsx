import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18N, toLocale, type Locale } from "@/i18n";
import { I18nProvider } from "@/i18n/react";
import { siteMetadata } from "@/seo";

import "../globals.css";

import type { Metadata } from "next";

// This `[locale]` layout is the app's root layout (it renders <html>/<body>) so
// `<html lang>` can be set per locale — the official Next i18n pattern. The
// segment values are the app's macro locales; middleware maps the public URLs
// (prefix-free default + `/pt`) onto them.
export function generateStaticParams(): { locale: Locale }[] {
  return (Object.keys(I18N.locales) as Locale[]).map((locale) => ({ locale }));
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export function generateMetadata(): Metadata {
  return {
    ...siteMetadata,
    ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
    // hreflang alternates (region tags via I18N.canonical) — emitted site-wide.
    alternates: {
      languages: {
        [I18N.locales.en.canonical]: "/",
        [I18N.locales.pt.canonical]: I18N.locales.pt.routePrefix,
        "x-default": "/",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);

  return (
    <html lang={I18N.locales[locale].canonical}>
      <body>
        {/* Client provider scopes the subtree to the locale's react-i18next
            instance so `useTranslation()` resolves the right language. */}
        <I18nProvider locale={locale}>
          <LanguageSwitcher />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
