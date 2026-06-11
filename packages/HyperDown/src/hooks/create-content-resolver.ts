import type { LazyExoticComponent } from "react";
import { lazy } from "react";

import type { ContentModuleMap, MdxComponent } from "../db/types";

// Module-level cache: reuses the same LazyExoticComponent for a given loader reference.
const lazyCache = new Map<
  () => Promise<{ default: MdxComponent }>,
  LazyExoticComponent<MdxComponent>
>();

/**
 * Resolves the MDX component for a slug+lang from a Vite glob map, trying
 * `…/{lang}/{slug}.mdx` then `…/{slug}.mdx`. Handles both glob shapes: an eager
 * namespace (server/prerender) returns a ready component for inline static HTML; a
 * lazy loader (browser) is wrapped once in `React.lazy`. Returns `null` if unmatched.
 */
export function getLazyFromModules(
  slug: string,
  lang: string,
  modules: ContentModuleMap,
): MdxComponent | LazyExoticComponent<MdxComponent> | null {
  if (Object.keys(modules).length === 0) return null;

  const withLang = `/${lang}/${slug}.mdx`;
  const withoutLang = `/${slug}.mdx`;

  const entries = Object.entries(modules);
  const find = (suffix: string) => entries.find(([key]) => key.endsWith(suffix))?.[1];

  const found = find(withLang) ?? find(withoutLang);
  if (!found) return null;

  // Eager glob entry: an already-evaluated module namespace → ready component.
  if (typeof found !== "function") return found.default;

  // Lazy glob entry: a dynamic-import loader → wrapped once in React.lazy.
  if (!lazyCache.has(found)) {
    lazyCache.set(found, lazy(found));
  }

  return lazyCache.get(found) ?? null;
}

/**
 * Browser-safe content resolver bound to a content type's Vite glob map — the
 * view-layer counterpart of the server-only `ContentRepository`. It touches no DB
 * code, so importing it never pulls the SSR SQLite client into a client bundle.
 *
 * `modules` must come from a **static** `import.meta.glob()` (Vite can't resolve
 * dynamic glob literals) — a single `contentModules[<name>]` entry of `@hyper-down/default`.
 *
 * @example
 * ```ts
 * export const getArticleContent = createContentResolver(contentModules["article"]);
 * const Body = getArticleContent(article.slug, article.locale);
 * ```
 */
export function createContentResolver(modules: ContentModuleMap) {
  /** Resolves the lazy MDX body component for a `slug`+`lang` (or `null`). */
  return (slug: string, lang: string) => getLazyFromModules(slug, lang, modules);
}
