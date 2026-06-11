import { Link as RouterLink } from "react-router";

import { useLocale, withLocale } from "@/i18n";

interface LinkProps {
  /** Logical (locale-free) path, e.g. `/articles`. */
  to: string;
  className?: string;
  children: React.ReactNode;
}

/** Locale-aware link: prefixes internal paths with the active locale prefix. */
export function Link({ to, className, children }: LinkProps) {
  const { locale } = useLocale();
  return (
    <RouterLink to={withLocale(locale, to)} className={className}>
      {children}
    </RouterLink>
  );
}
