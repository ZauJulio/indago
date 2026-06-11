// Dynamic import so this module loads even where `virtual:hyperdown-frontmatter`
// can't be resolved at init (e.g. RR prerender with HyperDown external). Falls back
// to {} → the default locale.
let frontmatter: Record<string, unknown> = {};

try {
  const mod = (await import("virtual:hyperdown-frontmatter")) as {
    default?: Record<string, unknown>;
  };
  frontmatter = mod.default ?? {};
} catch {
  frontmatter = {};
}

/** Canonical locale values stored in the SQLite database. */
type CanonicalLocale = "en" | "pt-BR";

/** Map from any language variant string to its canonical DB locale. */
type LocaleMap = Record<string, CanonicalLocale>;

/** Fallback locale when no match is found. */
const DEFAULT_LOCALE: CanonicalLocale = "en";

/** Lazy-loaded locale map built once from the frontmatter config. */
let localeMap: LocaleMap | null = null;

/** Maps common variants of each configured locale to its canonical DB value
 *  (e.g. "pt"/"pt-PT" → "pt-BR", "en-US"/"en-GB" → "en"). */
function buildLocaleMap(): LocaleMap {
  const map: LocaleMap = {};
  const config = frontmatter as Record<string, unknown>;

  const i18n = config["frontMatter.content.i18n"] as
    | Array<{ locale: string; path: string }>
    | undefined;

  if (!Array.isArray(i18n)) return map;

  for (const entry of i18n) {
    if (!entry.locale || !entry.path) continue;

    const canonical = entry.locale as CanonicalLocale;
    map[canonical] = canonical; // exact locale maps to itself

    if (canonical.startsWith("pt")) {
      map["pt"] = canonical;
      map["pt-BR"] = canonical;
      map["pt-PT"] = canonical;
    } else if (canonical.startsWith("en")) {
      map["en"] = canonical;
      map["en-US"] = canonical;
      map["en-GB"] = canonical;
    }
  }

  return map;
}

/** Resolves a raw language string (e.g. `"en-US"`) to its canonical DB locale,
 *  falling back to `"en"`. */
export function resolveI18n(lang?: string): CanonicalLocale {
  if (!localeMap) localeMap = buildLocaleMap();
  if (!lang) return DEFAULT_LOCALE;
  return localeMap[lang] ?? DEFAULT_LOCALE;
}

/** Returns the alternate locale for slug-query fallback (`"pt-BR"` ↔ `"en"`). */
export function getFallbackLocale(lang: string): CanonicalLocale {
  return lang === "pt-BR" ? "en" : "pt-BR";
}
