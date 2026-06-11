import type { AnchorHTMLAttributes } from "react";

import { usePageContext } from "vike-react/usePageContext";

import { withLocale } from "@/i18n";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Logical (locale-free) path, e.g. `/articles`. */
  to: string;
}

/** Locale-aware anchor: prefixes internal paths with the active locale prefix. */
export function Link({ to, children, ...rest }: LinkProps) {
  const { locale } = usePageContext();
  const href = to.startsWith("/") ? withLocale(locale, to) : to;

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
