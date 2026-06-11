import type { ComponentProps } from "react";

import { Link as RouterLink } from "@tanstack/react-router";

import { useLocale, withLocale } from "@/i18n";

type RouterTo = ComponentProps<typeof RouterLink>["to"];

interface LinkProps {
  /** Logical (locale-free) path, e.g. `/articles`. */
  to: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Locale-aware link: prefixes internal paths with the active locale prefix.
 * `to` is built dynamically (locale + slug), so it is cast to the router's
 * typed `to` union — TanStack resolves the string against the route tree at
 * runtime.
 */
export function Link({ to, className, children }: LinkProps) {
  const { locale } = useLocale();
  return (
    <RouterLink to={withLocale(locale, to) as RouterTo} className={className}>
      {children}
    </RouterLink>
  );
}
