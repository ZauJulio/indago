import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register a real DOM (happy-dom) so React can render the hooks under test.
// renderHook runs the actual hooks in a real React tree — no mocks.
GlobalRegistrator.register();

import { afterAll, describe, expect, test } from "bun:test";

import { renderHook } from "@testing-library/react";

import { useComposed } from "../../src/hooks/use-composed.ts";
import { useFilter } from "../../src/hooks/use-filter.ts";
import { usePaginate } from "../../src/hooks/use-paginate.ts";
import { useSearch } from "../../src/hooks/use-search.ts";
import { useSort } from "../../src/hooks/use-sort.ts";

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

interface Item {
  id: number;
  name: string;
  cuisine: string;
  tags: string[];
  rating: number | null;
}

const DATA: Item[] = [
  { id: 1, name: "Pizza", cuisine: "Italian", tags: ["dough", "veg"], rating: 5 },
  { id: 2, name: "Ramen", cuisine: "Japanese", tags: ["soup"], rating: 4 },
  { id: 3, name: "Pasta", cuisine: "Italian", tags: ["dough"], rating: null },
  { id: 4, name: "Sushi", cuisine: "Japanese", tags: ["fish", "veg"], rating: 3 },
];

describe("useFilter", () => {
  test("filters by string equality", () => {
    const { result } = renderHook(() => useFilter(DATA, [{ key: "cuisine", value: "Italian" }]));
    expect(result.current.map((i) => i.name)).toEqual(["Pizza", "Pasta"]);
  });

  test("filters by array inclusion", () => {
    const { result } = renderHook(() => useFilter(DATA, [{ key: "tags", value: "veg" }]));
    expect(result.current.map((i) => i.id)).toEqual([1, 4]);
  });

  test("ignores undefined / 'All' filters and ANDs multiple filters", () => {
    const { result } = renderHook(() =>
      useFilter(DATA, [
        { key: "cuisine", value: "All" },
        { key: "tags", value: "dough" },
        { key: "name", value: undefined },
      ]),
    );
    expect(result.current.map((i) => i.name)).toEqual(["Pizza", "Pasta"]);
  });

  test("returns the original array when no active filters", () => {
    const { result } = renderHook(() => useFilter(DATA, []));
    expect(result.current).toHaveLength(4);
  });
});

describe("useSort", () => {
  test("sorts strings with localeCompare ascending and descending", () => {
    const asc = renderHook(() => useSort(DATA, { key: "name", dir: "asc" }));
    expect(asc.result.current.map((i) => i.name)).toEqual(["Pasta", "Pizza", "Ramen", "Sushi"]);
    const desc = renderHook(() => useSort(DATA, { key: "name", dir: "desc" }));
    expect(desc.result.current.map((i) => i.name)).toEqual(["Sushi", "Ramen", "Pizza", "Pasta"]);
  });

  test("sorts numbers and pushes null/undefined to the end", () => {
    const { result } = renderHook(() => useSort(DATA, { key: "rating", dir: "desc" }));
    // 5,4,3 then the null rating (Pasta) last regardless of direction.
    expect(result.current.map((i) => i.name)).toEqual(["Pizza", "Ramen", "Sushi", "Pasta"]);
  });

  test("a null sort config returns the data unchanged", () => {
    const { result } = renderHook(() => useSort(DATA, null));
    expect(result.current.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  test("does not mutate the input array", () => {
    const copy = [...DATA];
    renderHook(() => useSort(DATA, { key: "name", dir: "asc" }));
    expect(DATA).toEqual(copy);
  });
});

describe("useSearch", () => {
  test("case-insensitive match across string and array fields", () => {
    const byName = renderHook(() => useSearch(DATA, "pi", ["name"]));
    expect(byName.result.current.map((i) => i.name)).toEqual(["Pizza"]);

    const byTag = renderHook(() => useSearch(DATA, "SOUP", ["tags"]));
    expect(byTag.result.current.map((i) => i.name)).toEqual(["Ramen"]);
  });

  test("an empty/whitespace query returns everything", () => {
    const { result } = renderHook(() => useSearch(DATA, "   ", ["name"]));
    expect(result.current).toHaveLength(4);
  });

  test("no field matches → empty result", () => {
    const { result } = renderHook(() => useSearch(DATA, "zzz", ["name", "cuisine"]));
    expect(result.current).toEqual([]);
  });
});

describe("usePaginate", () => {
  test("returns the slice + metadata for a page", () => {
    const { result } = renderHook(() => usePaginate(DATA, 1, 2));
    expect(result.current.items.map((i) => i.id)).toEqual([1, 2]);
    expect(result.current).toMatchObject({ page: 1, totalPages: 2, total: 4 });
  });

  test("clamps an out-of-range page to the last valid page", () => {
    const { result } = renderHook(() => usePaginate(DATA, 99, 2));
    expect(result.current.page).toBe(2);
    expect(result.current.items.map((i) => i.id)).toEqual([3, 4]);
  });

  test("an empty dataset yields one page and no items", () => {
    const { result } = renderHook(() => usePaginate([] as Item[], 1, 10));
    expect(result.current).toMatchObject({ page: 1, totalPages: 1, total: 0 });
    expect(result.current.items).toEqual([]);
  });
});

describe("useComposed", () => {
  test("chains filter → search → sort → paginate and exposes each stage", () => {
    const { result } = renderHook(() =>
      useComposed(DATA, {
        filters: [{ key: "cuisine", value: "Italian" }],
        searchQuery: "a",
        searchFields: ["name"],
        sort: { key: "name", dir: "asc" },
        page: 1,
        perPage: 1,
      }),
    );

    // Italian → Pizza, Pasta ; search "a" in name → both ; sorted asc → Pasta,Pizza.
    expect(result.current.filtered.map((i) => i.name)).toEqual(["Pizza", "Pasta"]);
    expect(result.current.sorted.map((i) => i.name)).toEqual(["Pasta", "Pizza"]);
    expect(result.current.paginated.items.map((i) => i.name)).toEqual(["Pasta"]);
    expect(result.current.paginated.totalPages).toBe(2);
  });

  test("defaults (no options) return everything paginated by 10", () => {
    const { result } = renderHook(() => useComposed(DATA));
    expect(result.current.paginated.items).toHaveLength(4);
    expect(result.current.paginated.totalPages).toBe(1);
  });
});
