import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { installCommand } from "./templates.ts";

import type { PackageManager, TemplateDef } from "./templates.ts";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

// `templates/` is a sibling of both `src/` (dev) and `dist/` (built), so the
// same relative path resolves in either context.
const TEMPLATES_ROOT = fileURLToPath(new URL("../templates", import.meta.url));
const SHARED_DIR = join(TEMPLATES_ROOT, "_shared");

// Files shipped under a leading-underscore name because npm/git strip the real
// dotfile from a published package; restored on generation.
const RENAME_ON_COPY: Record<string, string> = {
  _gitignore: ".gitignore",
  _npmrc: ".npmrc",
  _dockerignore: ".dockerignore",
  _env: ".env",
  "_env.example": ".env.example",
};

// Extensions whose contents are token-replaced. Everything else is copied byte
// for byte (images, .db, fonts, …).
const TEXT_EXT = new Set([
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".mdx",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".txt",
  ".env",
  ".example",
]);
const TEXT_NAMES = new Set([
  "_gitignore",
  "_dockerignore",
  "_npmrc",
  "_env",
  "Dockerfile",
  ".gitignore",
  ".dockerignore",
]);

export interface ScaffoldOptions {
  /** Absolute path of the directory to create. */
  targetDir: string;
  /** Project name written into `package.json#name`. */
  projectName: string;
  template: TemplateDef;
}

export interface TokenMap {
  [token: string]: string;
}

function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot);
  const base = path.slice(path.lastIndexOf("/") + 1);
  return TEXT_NAMES.has(base) || TEXT_EXT.has(ext);
}

function applyTokens(content: string, tokens: TokenMap): string {
  let out = content;
  for (const [token, value] of Object.entries(tokens)) {
    out = out.split(token).join(value);
  }
  return out;
}

/** Recursively copy `from` into `to`, applying token replacement + renames. */
async function copyTree(from: string, to: string, tokens: TokenMap): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true });
  await mkdir(to, { recursive: true });

  for (const entry of entries) {
    const src = join(from, entry.name);
    const destName = RENAME_ON_COPY[entry.name] ?? entry.name;
    const dest = join(to, destName);

    if (entry.isDirectory()) {
      // Never copy install/build artifacts that might linger in a template dir.
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") {
        continue;
      }
      await copyTree(src, dest, tokens);
      continue;
    }

    if (isTextFile(entry.name)) {
      const raw = await readFile(src, "utf8");
      await writeFile(dest, applyTokens(raw, tokens));
    } else {
      await cp(src, dest);
    }
  }
}

/** Resolve the templates root (exported for tests). */
export function templatesRoot(): string {
  return TEMPLATES_ROOT;
}

/**
 * Generate a project: overlay `_shared` then the chosen template into
 * `targetDir`, applying token replacement. Returns the list of created
 * top-level entries (sorted) for reporting/testing.
 */
export async function scaffold(opts: ScaffoldOptions): Promise<string[]> {
  const { targetDir, projectName, template } = opts;
  const templateDir = join(TEMPLATES_ROOT, template.id);

  if (!existsSync(SHARED_DIR)) {
    throw new Error(`Shared template tree not found at ${SHARED_DIR}`);
  }
  if (!existsSync(templateDir)) {
    throw new Error(`Unknown template "${template.id}" (looked in ${templateDir})`);
  }

  const tokens: TokenMap = {
    __PROJECT_NAME__: projectName,
    __TEMPLATE_ID__: template.id,
    // Markdown-safe aliases — `__x__` is bold in Markdown, so formatters/linters
    // mangle it inside .md files; use these there instead.
    "{{PROJECT_NAME}}": projectName,
    "{{TEMPLATE_ID}}": template.id,
  };

  await mkdir(targetDir, { recursive: true });
  await copyTree(SHARED_DIR, targetDir, tokens);
  await copyTree(templateDir, targetDir, tokens);

  const created = await readdir(targetDir);
  return created.sort();
}

/** True when `dir` does not exist or is an empty directory. */
export async function isDirReusable(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return true;
  const st = await stat(dir);
  if (!st.isDirectory()) return false;
  const entries = await readdir(dir);
  return entries.length === 0;
}

/** Run the package manager's install command in `cwd`, inheriting stdio. */
export function installDependencies(pm: PackageManager, cwd: string): Promise<void> {
  const [cmd = pm, ...args] = installCommand(pm).split(" ");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${installCommand(pm)} exited with code ${code}`));
    });
  });
}

// Re-exported helpers used by the test harness.
export { rename, rm, relative, resolve, dirname };
