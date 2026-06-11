import { describe, expect, test } from "bun:test";

import { getDisplayLocale, getFallbackLocale, getLocale } from "../../src/utils/i18n.ts";

// Locale mapping helpers. `resolveI18n` (behind getLocale) reads the frontmatter
// config, which is shimmed to `{}` in this test env, so it falls back to "en".

describe("getDisplayLocale", () => {
  test("maps any pt* language to the pt-BR display locale", () => {
    expect(getDisplayLocale("pt")).toBe("pt-BR");
    expect(getDisplayLocale("pt-BR")).toBe("pt-BR");
    expect(getDisplayLocale("pt-PT")).toBe("pt-BR");
  });

  test("maps everything else (incl. undefined) to en-US", () => {
    expect(getDisplayLocale("en")).toBe("en-US");
    expect(getDisplayLocale("en-GB")).toBe("en-US");
    expect(getDisplayLocale("fr")).toBe("en-US");
    expect(getDisplayLocale()).toBe("en-US");
  });

  test("produces a locale usable by Intl date formatting", () => {
    const d = new Date("2026-06-05T00:00:00Z");
    const ptParts = new Intl.DateTimeFormat(getDisplayLocale("pt"), {
      month: "long",
      timeZone: "UTC",
    }).format(d);
    expect(ptParts.toLowerCase()).toContain("junho");
  });
});

describe("getFallbackLocale", () => {
  test("the two canonical locales fall back to each other", () => {
    expect(getFallbackLocale("pt-BR")).toBe("en");
    expect(getFallbackLocale("en")).toBe("pt-BR");
  });

  test("any non-pt-BR value falls back to pt-BR", () => {
    expect(getFallbackLocale("anything")).toBe("pt-BR");
  });
});

describe("getLocale", () => {
  test("resolves to the default 'en' when the config is unavailable", () => {
    expect(getLocale({ language: "en-US" })).toBe("en");
    expect(getLocale()).toBe("en");
    expect(getLocale({})).toBe("en");
  });
});
