import type { ContentRepositoryOptions } from "./repository-types.ts";
import type { ContentRepository } from "./repository.ts";
import type { ContentMeta } from "./types.ts";

type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

/**
 * Lazy `ContentRepository<T>` proxy — the instance is constructed on first method
 * call, never at module load. Drop-in replacement for an eager instance.
 *
 * Load-bearing for module init-order, NOT for I/O (the constructor is pure).
 * Rolldown may init `ContentRepository`'s chunk *after* a consumer's `builder.ts`
 * chunk; a static import + synchronous `new` then races on concurrent cold requests
 * → `undefined is not a constructor` (intermittent SSR 500s, crashed prerender). A
 * memoized dynamic `import()` settles only once the module is fully evaluated,
 * removing the race. All public methods are async, so deferral is transparent.
 *
 * @typeParam T - Collection metadata shape (e.g. `ArticleMeta`).
 */
export function createLazyRepository<T extends ContentMeta = ContentMeta>(
  options: ContentRepositoryOptions,
): ContentRepository<T> {
  let instance: ContentRepository<T> | undefined;
  let pending: Promise<ContentRepository<T>> | undefined;

  async function resolve(): Promise<ContentRepository<T>> {
    if (!instance) {
      pending ??= import("./repository.ts").then((mod) => {
        instance = new mod.ContentRepository<T>(options);
        return instance;
      });

      await pending;
    }

    return instance as ContentRepository<T>;
  }

  return new Proxy({} as ContentRepository<T>, {
    get(_target, prop) {
      // Data props derive from `options` — answer synchronously without constructing.
      if (prop === "contentName") return options.contentName;
      if (prop === "ftsTable") return options.ftsTable ?? `${options.contentName}_fts`;

      // Async methods forward to the lazily-imported instance (see above).
      const forward: AsyncMethod = async (...args) => {
        const repo = await resolve();
        return (Reflect.get(repo, prop) as AsyncMethod).apply(repo, args);
      };
      return forward;
    },
  });
}
