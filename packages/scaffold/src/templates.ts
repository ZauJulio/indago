// Registry of the frameworks `create-virtus-app` can scaffold. Each template is
// a directory under `templates/<id>/` overlaid on top of `templates/_shared/`.
export interface TemplateDef {
  /** Directory name under `templates/` and the value stored in config. */
  id: string;
  /** CLI flag (without the leading `--`). */
  flag: string;
  /** Human label shown in the interactive picker. */
  label: string;
  /** One-line description shown in the picker hint. */
  hint: string;
  /** Command to run the dev server, shown in the "next steps" outro. */
  devCommand: string;
}

export const TEMPLATES: readonly TemplateDef[] = [
  {
    id: "vike",
    flag: "vike",
    label: "Vike",
    hint: "Vike + vike-react + Hono SSR/SSG (the reference consumer)",
    devCommand: "dev",
  },
  {
    id: "react-router",
    flag: "react-router",
    label: "React Router v7",
    hint: "React Router v7 framework mode (Vite + SSR loaders)",
    devCommand: "dev",
  },
  {
    id: "tanstack",
    flag: "tanstack",
    label: "TanStack Start",
    hint: "TanStack Start (Vite + server route loaders)",
    devCommand: "dev",
  },
  {
    id: "next",
    flag: "next",
    label: "Next.js",
    hint: "Next.js App Router (@next/mdx + node:sqlite, codegen prebuild)",
    devCommand: "dev",
  },
];

export const TEMPLATE_BY_FLAG: ReadonlyMap<string, TemplateDef> = new Map(
  TEMPLATES.map((t) => [t.flag, t]),
);

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export const PACKAGE_MANAGERS: readonly PackageManager[] = ["bun", "npm", "pnpm", "yarn"];

/** Best-effort detection of the package manager that invoked the CLI. */
export function detectPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("npm")) return "npm";
  return "npm";
}

export function installCommand(pm: PackageManager): string {
  return pm === "yarn" ? "yarn" : `${pm} install`;
}

export function runCommand(pm: PackageManager, script: string): string {
  if (pm === "npm") return `npm run ${script}`;
  return `${pm} ${script}`;
}
