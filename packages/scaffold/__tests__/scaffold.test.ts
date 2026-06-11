import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import { isDirReusable, scaffold, templatesRoot } from "../src/scaffold.ts";
import {
  detectPackageManager,
  installCommand,
  runCommand,
  TEMPLATE_BY_FLAG,
  TEMPLATES,
} from "../src/templates.ts";

const work = mkdtempSync(join(tmpdir(), "scaffold-test-"));

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("templates registry", () => {
  test("ships the four frameworks, each with a real template directory", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(["next", "react-router", "tanstack", "vike"]);

    for (const t of TEMPLATES) {
      expect(existsSync(join(templatesRoot(), t.id))).toBe(true);
    }
    expect(existsSync(join(templatesRoot(), "_shared"))).toBe(true);
  });

  test("flags resolve to their template", () => {
    expect(TEMPLATE_BY_FLAG.get("react-router")?.id).toBe("react-router");
    expect(TEMPLATE_BY_FLAG.get("unknown")).toBeUndefined();
  });
});

describe("package manager helpers", () => {
  test("installCommand covers every package manager", () => {
    expect(installCommand("bun")).toBe("bun install");
    expect(installCommand("yarn")).toBe("yarn");
  });

  test("runCommand uses `npm run` only for npm", () => {
    expect(runCommand("npm", "dev")).toBe("npm run dev");
    expect(runCommand("bun", "dev")).toBe("bun dev");
  });

  test("detectPackageManager falls back to npm", () => {
    const prev = process.env.npm_config_user_agent;
    delete process.env.npm_config_user_agent;
    expect(detectPackageManager()).toBe("npm");
    process.env.npm_config_user_agent = "bun/1.3.5";
    expect(detectPackageManager()).toBe("bun");

    if (prev === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = prev;
  });
});

describe("isDirReusable", () => {
  test("missing and empty dirs are reusable; non-empty and files are not", async () => {
    expect(await isDirReusable(join(work, "does-not-exist"))).toBe(true);

    const empty = join(work, "empty");
    mkdirSync(empty, { recursive: true });
    expect(await isDirReusable(empty)).toBe(true);

    const file = join(work, "a-file");
    writeFileSync(file, "x");
    expect(await isDirReusable(file)).toBe(false);
  });
});

describe("scaffold", () => {
  test("overlays _shared + template, applies tokens, and restores dotfiles", async () => {
    const target = join(work, "app-vike");
    const template = TEMPLATE_BY_FLAG.get("vike");
    if (!template) throw new Error("vike template missing");

    const created = await scaffold({ targetDir: target, projectName: "my-app", template });

    // Shared overlay + template overlay both landed.
    expect(created).toContain("content");
    expect(created).toContain("vite.config.ts");

    // Token replacement reached package.json.
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-app");

    // …and the README, via the Markdown-safe `{{…}}` aliases (a formatter once
    // mangled `__PROJECT_NAME__` into `**PROJECT_NAME**`, breaking replacement).
    const readme = readFileSync(join(target, "README.md"), "utf8");
    expect(readme).toContain("# my-app");
    expect(readme).not.toContain("PROJECT_NAME");
    expect(readme).toContain("`vike` template");

    // Underscore-prefixed files are restored to real dotfiles.
    expect(existsSync(join(target, ".gitignore"))).toBe(true);
    expect(existsSync(join(target, "_gitignore"))).toBe(false);

    // Install/build artifacts are never copied.
    expect(existsSync(join(target, "node_modules"))).toBe(false);
    expect(existsSync(join(target, "dist"))).toBe(false);
  });

  test("rejects an unknown template id", async () => {
    const bogus = { id: "nope", flag: "nope", label: "?", hint: "", devCommand: "dev" };
    expect(
      scaffold({ targetDir: join(work, "x"), projectName: "x", template: bogus }),
    ).rejects.toThrow(/Unknown template/);
  });
});
