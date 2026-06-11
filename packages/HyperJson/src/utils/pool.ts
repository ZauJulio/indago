import { cpus } from "node:os";

/**
 * Resolve the worker concurrency limit from (in priority order): an explicit
 * value, the `HYPERJSON_CONCURRENCY` env var, then `cpus().length - 1` (min 1)
 * — leaving a core free to keep the build responsive.
 */
export function resolveConcurrency(explicit?: number): number {
  if (explicit && explicit > 0) return Math.floor(explicit);

  const fromEnv = Number(process.env.HYPERJSON_CONCURRENCY);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);

  return Math.max(1, cpus().length - 1);
}

/**
 * Run `tasks` with at most `limit` in flight at any time, preserving the
 * result order. A lightweight promise pool — no worker_threads overhead, since
 * each task is an async, in-process schema compilation.
 */
export async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results = Array.from({ length: tasks.length }) as T[];
  let cursor = 0;

  const runners = Array.from({ length: Math.min(Math.max(limit, 1), tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  });

  await Promise.all(runners);
  return results;
}
