/**
 * Generates runnable example apps under the repo's `examples/<id>/` — one per
 * scaffold template — so the templates can be inspected and run locally.
 *
 * It mirrors `test-templates.ts` but is **persistent**: it packs the two local
 * engines into `examples/.engines/*.tgz`, scaffolds each template into
 * `examples/<id>/`, rewrites the `@indago/*` deps to those tarballs via a
 * *relative* `file:` link (so the tree stays portable and identical to what a
 * real `@indago/create-app` consumer gets), installs, then builds + runs the
 * Playwright e2e suite against each template's production server. Nothing is
 * cleaned up — the apps are left in place to run.
 *
 * Usage:
 *   bun scripts/gen-examples.ts              # all templates
 *   bun scripts/gen-examples.ts vike next    # a subset
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TEMPLATES } from "../src/templates.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const CLI = join(PKG_ROOT, "dist", "index.mjs");
const EXAMPLES_DIR = join(REPO_ROOT, "examples");
const ENGINES_DIR = join(EXAMPLES_DIR, ".engines");

const ENGINES = [
  { name: "@indago/hyper-down", dir: join(REPO_ROOT, "packages", "HyperDown") },
  { name: "@indago/hyper-json", dir: join(REPO_ROOT, "packages", "HyperJson") },
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

/** Point the app's `@indago/*` deps at the packed tarballs via a relative `file:` link. */
function linkEngines(appDir: string, tarballs: Record<string, string>): void {
  const pkgPath = join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  for (const [name, tarball] of Object.entries(tarballs)) {
    if (pkg.dependencies?.[name]) {
      // Relative so the committed examples/ tree is portable across machines.
      pkg.dependencies[name] = `file:${relative(appDir, tarball)}`;
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function main(): void {
  const requested = process.argv.slice(2);
  const templates = requested.length
    ? TEMPLATES.filter((t) => requested.includes(t.id))
    : TEMPLATES;

  if (templates.length === 0) {
    throw new Error(`No matching templates for: ${requested.join(", ")}`);
  }

  mkdirSync(ENGINES_DIR, { recursive: true });
  process.stdout.write(`▸ examples dir: ${EXAMPLES_DIR}\n`);

  // Build the CLI + pack the engines once.
  run("bun", ["run", "build"], PKG_ROOT);
  const tarballs: Record<string, string> = {};
  for (const engine of ENGINES) tarballs[engine.name] = buildAndPack(engine.dir, ENGINES_DIR);

  // Ensure a browser is available for Playwright.
  run("bunx", ["playwright", "install", "chromium"], PKG_ROOT);

  const failures: string[] = [];
  for (const template of templates) {
    const appDir = join(EXAMPLES_DIR, template.id);
    process.stdout.write(`\n━━━ ${template.label} (${template.id}) ━━━\n`);
    try {
      // Regenerate from scratch — the CLI scaffolds into a fresh directory.
      if (existsSync(appDir)) rmSync(appDir, { recursive: true, force: true });
      run("node", [CLI, appDir, `--${template.flag}`, "--no-install"], EXAMPLES_DIR);
      linkEngines(appDir, tarballs);
      run("bun", ["install"], appDir);
      run("bun", ["run", "build"], appDir);
      run("bun", ["run", "typecheck"], appDir);
      run("bun", ["run", "test"], appDir);
      run("bunx", ["playwright", "test"], appDir);
      process.stdout.write(`✓ ${template.id} ready\n`);
    } catch (err) {
      failures.push(template.id);
      process.stderr.write(`✗ ${template.id} failed: ${(err as Error).message}\n`);
    }
  }

  if (failures.length) {
    process.stderr.write(`\nFailed templates: ${failures.join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write("\nAll examples generated.\n");
}

main();
