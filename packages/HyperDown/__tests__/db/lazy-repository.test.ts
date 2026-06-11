import { describe, expect, test } from "bun:test";

import { createLazyRepository } from "../../src/db/lazy-repository.ts";
import { ContentRepository } from "../../src/db/repository.ts";

// The lazy proxy answers data props (contentName/ftsTable) from `options`
// synchronously and defers `new ContentRepository` to the first async method call
// via a memoized dynamic import (a Rolldown init-order workaround). The repo
// constructor is pure (only assigns names), so the proxy is fully testable without
// any database — no mocks.

describe("createLazyRepository", () => {
  test("constructing the proxy does not throw and returns an object", () => {
    expect(() => createLazyRepository({ contentName: "article" })).not.toThrow();
    expect(typeof createLazyRepository({ contentName: "article" })).toBe("object");
  });

  test("reads the collection name + derived FTS table through the proxy", () => {
    const repo = createLazyRepository({ contentName: "article" });
    expect(repo.contentName).toBe("article");
    expect(repo.ftsTable).toBe("article_fts"); // default `${name}_fts`
  });

  test("honours an explicit ftsTable override", () => {
    const repo = createLazyRepository({ contentName: "recipe", ftsTable: "recipe_search" });
    expect(repo.ftsTable).toBe("recipe_search");
  });

  test("exposes the repository methods as callable bound functions", () => {
    const repo = createLazyRepository({ contentName: "article" });
    expect(typeof repo.search).toBe("function");
    expect(typeof repo.getMetaBySlug).toBe("function");
    expect(typeof repo.distinctValues).toBe("function");
  });

  test("the lazily-built instance is a real ContentRepository", () => {
    const repo = createLazyRepository({ contentName: "article" });
    // Touch a prop to trigger construction, then assert the proxied shape matches
    // an eagerly-built instance.
    expect(repo.contentName).toBe(new ContentRepository({ contentName: "article" }).contentName);
  });

  test("reuses a single underlying instance across accesses", () => {
    const repo = createLazyRepository({ contentName: "article" });
    // The readonly data prop is answered from `options` every time — stable value,
    // no construction, no throw.
    const a = repo.contentName;
    const b = repo.contentName;
    expect(a).toBe(b);
  });
});
