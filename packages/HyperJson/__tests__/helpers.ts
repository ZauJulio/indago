import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Real CLI harness — no mocks. Spawns the actual `hyperjson` entrypoint
 * (`cli/hyperjson.ts`) inside a throwaway directory and asserts on real exit
 * codes and real generated files, as a consuming project would.
 */
const CLI = resolve(import.meta.dir, "../cli/hyperjson.ts");

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runCli(args: string[], cwd: string): CliResult {
  const proc = spawnSync("bun", [CLI, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  return {
    exitCode: proc.status ?? 1,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
  };
}

export function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), "hyperjson-test-"));
}

export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
