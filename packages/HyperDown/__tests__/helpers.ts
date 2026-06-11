import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Real CLI harness — no mocks. Tests spawn the actual `hyperdown` entrypoint
 * (`cli/hyperdown.ts`) inside a throwaway directory and assert on real exit
 * codes, real files, and real SQLite output, exactly as a consuming project
 * that installed the package would experience it.
 */
const CLI = resolve(import.meta.dir, "../cli/hyperdown.ts");

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs `hyperdown <args>` in `cwd` and returns the captured result. */
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

/** Creates an isolated temp project directory. */
export function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), "hyperdown-test-"));
}

/** Removes a temp project directory (best-effort). */
export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
