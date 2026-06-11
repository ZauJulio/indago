import { afterEach, describe, expect, test } from "bun:test";

import { resolveConcurrency, runPool } from "../../src/utils/pool.ts";

// Real promise-pool behaviour — no mocks, no timers faked.

const ORIGINAL_ENV = process.env.HYPERDOWN_CONCURRENCY;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.HYPERDOWN_CONCURRENCY;
  else process.env.HYPERDOWN_CONCURRENCY = ORIGINAL_ENV;
});

describe("resolveConcurrency", () => {
  test("an explicit positive value wins and is floored", () => {
    expect(resolveConcurrency(4)).toBe(4);
    expect(resolveConcurrency(3.9)).toBe(3);
  });

  test("falls back to HYPERDOWN_CONCURRENCY when no explicit value", () => {
    process.env.HYPERDOWN_CONCURRENCY = "5";
    expect(resolveConcurrency()).toBe(5);
    expect(resolveConcurrency(0)).toBe(5); // 0 is not "positive", so env applies
  });

  test("ignores a non-positive / non-numeric env value", () => {
    process.env.HYPERDOWN_CONCURRENCY = "-2";
    expect(resolveConcurrency()).toBeGreaterThanOrEqual(1);
    process.env.HYPERDOWN_CONCURRENCY = "nan";
    expect(resolveConcurrency()).toBeGreaterThanOrEqual(1);
  });

  test("defaults to at least 1 with neither explicit nor env", () => {
    delete process.env.HYPERDOWN_CONCURRENCY;
    expect(resolveConcurrency()).toBeGreaterThanOrEqual(1);
  });
});

describe("runPool", () => {
  test("preserves result order regardless of completion order", async () => {
    const tasks = [30, 5, 20, 1, 15].map(
      (ms, i) => () => new Promise<number>((r) => setTimeout(() => r(i), ms)),
    );
    expect(await runPool(tasks, 2)).toEqual([0, 1, 2, 3, 4]);
  });

  test("never exceeds the concurrency limit of in-flight tasks", async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, () => async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return inFlight;
    });

    await runPool(tasks, 3);
    expect(peak).toBeLessThanOrEqual(3);
  });

  test("returns [] for an empty task list", async () => {
    expect(await runPool([], 4)).toEqual([]);
  });

  test("a limit below 1 still makes progress (clamped to 1)", async () => {
    expect(await runPool([async () => "a", async () => "b"], 0)).toEqual(["a", "b"]);
  });
});
