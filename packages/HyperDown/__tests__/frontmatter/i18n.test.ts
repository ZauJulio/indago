import { describe, expect, test } from "bun:test";

import { getFallbackLocale, resolveI18n } from "../../src/frontmatter/i18n.ts";

// Pure locale helpers. `resolveI18n` builds its map from the (virtual)
// frontmatter config, which is absent here, so it falls back to the default
// canonical locale — the documented behaviour when no config is resolvable.

describe("getFallbackLocale", () => {
  test("pairs each canonical locale with the other", () => {
    expect(getFallbackLocale("pt-BR")).toBe("en");
    expect(getFallbackLocale("en")).toBe("pt-BR");
  });

  test("treats any non-pt-BR value as English-primary", () => {
    expect(getFallbackLocale("fr")).toBe("pt-BR");
  });
});

describe("resolveI18n", () => {
  test("defaults to 'en' when no language is given", () => {
    expect(resolveI18n()).toBe("en");
  });

  test("falls back to 'en' for unmapped languages", () => {
    expect(resolveI18n("zz")).toBe("en");
  });
});
