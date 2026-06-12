import { describe, expect, test } from "bun:test";

import * as hooks from "../src/hooks/index.ts";
import * as lib from "../src/lib/index.ts";
import * as plugins from "../src/plugins/index.ts";

// Smoke test of HyperJson's three public entries (`.`, `./hooks`, `./plugins`) —
// no mocks. Catches an accidental export removal/rename.

describe("@muttum/hyper-json (lib entry `.`)", () => {
  test("exposes config + validation runtime helpers", () => {
    expect(typeof lib.loadHyperJsonConfig).toBe("function");
    expect(typeof lib.validateHyperJsonConfig).toBe("function");
    expect(typeof lib.validateContentSchemas).toBe("function");
    expect(typeof lib.hyperjsonValidationPlugin).toBe("function");
  });
});

describe("@muttum/hyper-json/hooks", () => {
  test("exports every headless data hook", () => {
    for (const name of ["useFilter", "useSearch", "useSort", "usePaginate", "useComposed"]) {
      expect(typeof hooks[name as keyof typeof hooks]).toBe("function");
    }
  });
});

describe("@muttum/hyper-json/plugins", () => {
  test("the validation plugin is a Vite plugin with the expected name", () => {
    expect(typeof plugins.hyperjsonValidationPlugin).toBe("function");
    const p = plugins.hyperjsonValidationPlugin() as { name?: string };
    expect(p.name).toBe("vite-plugin-hyperjson");
  });
});
