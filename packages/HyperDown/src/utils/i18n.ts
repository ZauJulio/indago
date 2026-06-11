import { resolveI18n, getFallbackLocale } from "../frontmatter/i18n.ts";

/**
 * Resolves the current locale from an i18n instance to the canonical DB locale.
 *
 * @param i18n - Optional i18n object with a `language` property (e.g. from `react-i18next`).
 * @returns Canonical locale string (e.g. `"en"` or `"pt-BR"`).
 */
export function getLocale(i18n?: { language?: string }): string {
  return resolveI18n(i18n?.language);
}

export { getFallbackLocale };

/**
 * Maps an i18n language string to a BCP 47 display locale for `Intl` APIs
 * (e.g. `toLocaleDateString`). Falls back to `"en-US"` for unknown languages.
 */
export function getDisplayLocale(lang?: string): string {
  if (lang?.startsWith("pt")) return "pt-BR";
  return "en-US";
}
