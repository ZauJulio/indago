import { describe, expect, test } from "bun:test";

import {
  createContentResolver,
  getLazyFromModules,
} from "../../src/hooks/create-content-resolver.ts";

import type { ContentModuleMap } from "../../src/db/types";

// Real Vite-glob-shaped module maps (eager namespaces + lazy loaders) and the
// real React.lazy caching path — no mocks. We assert resolution + identity, not
// rendering, so no DOM is required.

const Eager = () => null; // a stand-in MDX component
const map = (entries: Record<string, unknown>): ContentModuleMap => entries as ContentModuleMap;

describe("getLazyFromModules", () => {
  test("returns null for an empty module map", () => {
    expect(getLazyFromModules("post", "en", map({}))).toBeNull();
  });

  test("returns the component of an EAGER module namespace as-is", () => {
    const resolved = getLazyFromModules(
      "post",
      "en",
      map({ "/content/article/en/post.mdx": { default: Eager } }),
    );
    expect(resolved).toBe(Eager); // eager → ready component, not a lazy wrapper
  });

  test("prefers the /{lang}/{slug}.mdx entry over the bare /{slug}.mdx", () => {
    const LangComp = () => null;
    const BareComp = () => null;
    const resolved = getLazyFromModules(
      "post",
      "en",
      map({
        "/content/article/post.mdx": { default: BareComp },
        "/content/article/en/post.mdx": { default: LangComp },
      }),
    );
    expect(resolved).toBe(LangComp);
  });

  test("falls back to the bare /{slug}.mdx when there is no localized entry", () => {
    const BareComp = () => null;
    const resolved = getLazyFromModules(
      "post",
      "pt-BR",
      map({ "/content/article/post.mdx": { default: BareComp } }),
    );
    expect(resolved).toBe(BareComp);
  });

  test("returns null when no key matches the slug", () => {
    expect(
      getLazyFromModules(
        "missing",
        "en",
        map({ "/content/article/en/post.mdx": { default: Eager } }),
      ),
    ).toBeNull();
  });

  test("wraps a LAZY loader in React.lazy and caches by loader reference", () => {
    const loader = () => Promise.resolve({ default: Eager });
    const modules = map({ "/content/article/en/lazy.mdx": loader });

    const a = getLazyFromModules("lazy", "en", modules);
    const b = getLazyFromModules("lazy", "en", modules);

    expect(a).not.toBeNull();
    expect(a).not.toBe(Eager); // it's a lazy wrapper, not the raw component
    expect(typeof a).toBe("object");
    expect(a).toBe(b); // same loader → same cached LazyExoticComponent
  });
});

describe("createContentResolver", () => {
  test("returns a resolver bound to its module map", () => {
    const resolve = createContentResolver(
      map({ "/content/article/en/post.mdx": { default: Eager } }),
    );
    expect(resolve("post", "en")).toBe(Eager);
    // The bare `/{slug}.mdx` fallback is a suffix match, so an unknown locale
    // still resolves the existing file (its key ends with `/post.mdx`).
    expect(resolve("post", "fr")).toBe(Eager);
    // A slug with no matching key resolves to null.
    expect(resolve("nope", "en")).toBeNull();
  });
});
