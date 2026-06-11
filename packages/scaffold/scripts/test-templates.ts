/**
 * End-to-end harness for the scaffolded templates.
 *
 * For each template it: packs the two local engines to tarballs, scaffolds a
 * fresh app into a temp dir, rewrites the `@virtus/*` deps to the local
 * tarballs, installs, builds (which runs the engines' codegen), then runs the
 * app's unit + Playwright e2e suites. Every template ships the SAME routes, so
 * the same standardized specs must pass on all of them.
 *
 * Usage:
 *   bun scripts/test-templates.ts              # all templates
 *   bun scripts/test-templates.ts vike next    # a subset
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TEMPLATES } from "../src/templates.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const CLI = join(PKG_ROOT, "dist", "index.mjs");

const ENGINES = [
  { name: "@virtus/hyper-down", dir: join(REPO_ROOT, "packages", "HyperDown") },
  { name: "@virtus/hyper-json", dir: join(REPO_ROOT, "packages", "HyperJson") },
];

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): void {
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

/** Build + pack a package, returning the absolute path of the produced tarball. */
function buildAndPack(dir: string, dest: string): string {
  run("bun", ["run", "build"], dir);
  const out = execFileSync("bun", ["pm", "pack", "--destination", dest], { cwd: dir }).toString();
  const match = out.match(/[^\s]+\.tgz/);
  if (!match) throw new Error(`Could not determine tarball name from:\n${out}`);
  // `bun pm pack` prints the file name (relative to the package dir).
  const fileName = match[0].split("/").pop() as string;
  return join(dest, fileName);
}

function linkEngines(appDir: string, tarballs: Record<string, string>): void {
  const pkgPath = join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  for (const [name, tarball] of Object.entries(tarballs)) {
    if (pkg.dependencies?.[name]) pkg.dependencies[name] = `file:${tarball}`;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function main(): void {
  const requested = process.argv.slice(2);
  const templates = requested.length
    ? TEMPLATES.filter((t) => requested.includes(t.id))
    : TEMPLATES;

  if (templates.length === 0) {
    throw new Error(`No matching templates for: ${requested.join(", ")}`);
  }

  const work = mkdtempSync(join(tmpdir(), "create-virtus-app-"));
  process.stdout.write(`▸ work dir: ${work}\n`);

  // Build the CLI + pack the engines once.
  run("bun", ["run", "build"], PKG_ROOT);
  const tarballs: Record<string, string> = {};
  for (const engine of ENGINES) tarballs[engine.name] = buildAndPack(engine.dir, work);

  // Ensure a browser is available for Playwright.
  run("bunx", ["playwright", "install", "chromium"], PKG_ROOT);

  const failures: string[] = [];
  for (const template of templates) {
    const appDir = join(work, `app-${template.id}`);
    process.stdout.write(`\n━━━ ${template.label} (${template.id}) ━━━\n`);
    try {
      run("node", [CLI, appDir, `--${template.flag}`, "--no-install"], work);
      linkEngines(appDir, tarballs);
      run("bun", ["install"], appDir);
      run("bun", ["run", "build"], appDir);
      run("bun", ["run", "typecheck"], appDir);
      run("bun", ["run", "test"], appDir);
      run("bunx", ["playwright", "test"], appDir);
      process.stdout.write(`✓ ${template.id} passed\n`);
    } catch (err) {
      failures.push(template.id);
      process.stderr.write(`✗ ${template.id} failed: ${(err as Error).message}\n`);
    }
  }

  if (failures.length) {
    process.stderr.write(`\nFailed templates: ${failures.join(", ")}\n`);
    rmSync(work, { recursive: true, force: true });
    process.exit(1);
  }
  process.stdout.write("\nAll templates passed.\n");
  rmSync(work, { recursive: true, force: true });
}

main();
