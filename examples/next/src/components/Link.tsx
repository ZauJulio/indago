"use client";

import NextLink from "next/link";

import { withLocale } from "@/i18n";
import { useLocale } from "@/i18n/react";

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
    <NextLink href={withLocale(locale, to)} className={className}>
      {children}
    </NextLink>
  );
}
