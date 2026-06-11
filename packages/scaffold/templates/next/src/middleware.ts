import { NextResponse, type NextRequest } from "next/server";

import { I18N } from "@/i18n";

const ptPrefix = I18N.locales.pt.routePrefix; // "/pt"

/**
 * Locale routing without folder duplication.
 *
 * The whole app lives under a single `app/[locale]` tree whose segment values are
 * the app's macro locales (`en` / `pt`). `/pt` and `/pt/…` already map onto the
 * `pt` segment, so they pass through untouched. The default locale is served
 * prefix-free, so everything else is rewritten onto the `en` segment.
 *
 * `NextResponse.rewrite` keeps the visible URL unchanged, so `usePathname()` in
 * the client still sees the public path and `localeFromPath` resolves correctly.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // `/pt` and `/pt/…` already resolve to the `pt` segment — leave them as-is.
  if (pathname === ptPrefix || pathname.startsWith(`${ptPrefix}/`)) {
    return NextResponse.next();
  }

  // Default locale is served prefix-free → rewrite onto the `en` segment.
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on everything except Next internals, the API, and files with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
