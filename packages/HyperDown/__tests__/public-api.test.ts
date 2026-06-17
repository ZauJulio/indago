import { describe, expect, test } from "bun:test";

import * as main from "../src/index.ts";
import * as plugins from "../src/plugins/index.ts";
import * as server from "../src/server.ts";

// Guards the package's public surface: a smoke test that the documented exports
// (and Vite plugin shapes) stay present — no mocks. Catches an accidental export
// removal / rename that the type-only barrel wouldn't surface at runtime.

describe("@indago/hyper-down (browser-safe barrel)", () => {
  test("exposes the view-layer + parser + i18n runtime helpers", () => {
    for (const name of [
      "createContentResolver",
      "MdxRender",
      "MermaidBlock",
      "defaultMdxComponents",
      "createMdxComponents",
      "parseFrontmatter",
      "getLocale",
      "getDisplayLocale",
      "getFallbackLocale",
      "Sidebar",
      "parseSections",
      "extractSectionRecords",
    ]) {
      expect(main[name as keyof typeof main], name).toBeDefined();
    }
  });
});

describe("@indago/hyper-down/server (server-only barrel)", () => {
  test("exposes the data-access runtime values", () => {
    expect(typeof server.ContentRepository).toBe("function");
    expect(typeof server.createLazyRepository).toBe("function");
    expect(server.hyperDownClient).toBeDefined();
    expect(typeof server.hyperDownClient.query).toBe("function");
  });
});

describe("@indago/hyper-down/plugins", () => {
  test("exports the three Vite plugin factories", () => {
    expect(typeof plugins.hyperdownPlugin).toBe("function");
    expect(typeof plugins.hyperdownSitemapPlugin).toBe("function");
    expect(typeof plugins.hyperdownMdxPlugin).toBe("function");
  });

  test("the MDX plugin enforces 'pre' (must run before vike/react)", () => {
    const p = plugins.hyperdownMdxPlugin({}) as { enforce?: string };
    expect(p.enforce).toBe("pre");
  });

  test("exports remarkHeadingBadges (strips `#[label/#color]` from headings)", () => {
    expect(typeof plugins.remarkHeadingBadges).toBe("function");
    const tree = {
      type: "root",
      children: [{ type: "heading", children: [{ type: "text", value: "Setup #[beta/#000000]" }] }],
    };
    plugins.remarkHeadingBadges()(tree as never);
    expect((tree.children[0].children[0] as { value: string }).value).toBe("Setup");
  });

  test("the sitemap plugin is a build-only plugin with the expected name", () => {
    const p = plugins.hyperdownSitemapPlugin();
    expect(p.name).toBe("vite-plugin-hyperdown-sitemap");
    expect(p.apply).toBe("build");
  });
});
