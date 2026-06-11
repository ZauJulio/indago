import { cpus } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";

import { resolveConcurrency, runPool } from "../src/utils/pool.ts";

// The bounded-concurrency worker pool behind codegen — pure, real execution.

describe("resolveConcurrency", () => {
  const original = process.env.HYPERJSON_CONCURRENCY;
  afterEach(() => {
    if (original === undefined) delete process.env.HYPERJSON_CONCURRENCY;
    else process.env.HYPERJSON_CONCURRENCY = original;
  });

  test("prefers an explicit value", () => {
    expect(resolveConcurrency(3)).toBe(3);
  });

  test("falls back to the HYPERJSON_CONCURRENCY env var", () => {
    process.env.HYPERJSON_CONCURRENCY = "5";
    expect(resolveConcurrency()).toBe(5);
  });

  test("defaults to cpus().length - 1 (min 1) for invalid/missing values", () => {
    const expected = Math.max(1, cpus().length - 1);
    delete process.env.HYPERJSON_CONCURRENCY;
    expect(resolveConcurrency()).toBe(expected);
    process.env.HYPERJSON_CONCURRENCY = "0";
    expect(resolveConcurrency()).toBe(expected);
    process.env.HYPERJSON_CONCURRENCY = "nope";
    expect(resolveConcurrency()).toBe(expected);
  });
});

describe("runPool", () => {
  test("runs every task and preserves result order", async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => async () => {
      await new Promise((r) => setTimeout(r, (6 - n) * 5));
      return n * 10;
    });
    expect(await runPool(tasks, 2)).toEqual([10, 20, 30, 40, 50]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    });

    await runPool(tasks, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
