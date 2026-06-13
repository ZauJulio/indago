import { cancel, confirm, isCancel, select, text } from "@clack/prompts";

import { detectPackageManager, PACKAGE_MANAGERS, TEMPLATES } from "./templates.ts";

import type { PackageManager, TemplateDef } from "./templates.ts";

function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Scaffolding cancelled.");
    process.exit(0);
  }
  return value as T;
}

export async function promptProjectDir(initial?: string): Promise<string> {
  const value = await text({
    message: "Where should we create your project?",
    placeholder: "./my-indago-app",
    initialValue: initial ?? "./my-indago-app",
    validate(v) {
      if (!v || v.trim().length === 0) return "Please enter a directory.";
      return undefined;
    },
  });
  return ensure(value).trim();
}

export async function promptTemplate(): Promise<TemplateDef> {
  const id = ensure(
    await select({
      message: "Which framework?",
      options: TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
    }),
  );
  const found = TEMPLATES.find((t) => t.id === id);
  if (!found) {
    cancel(`Unknown template "${String(id)}".`);
    process.exit(1);
  }
  return found;
}

export async function promptPackageManager(): Promise<PackageManager> {
  const detected = detectPackageManager();
  return ensure(
    await select({
      message: "Install dependencies with?",
      initialValue: detected,
      options: PACKAGE_MANAGERS.map((pm) => ({
        value: pm,
        label: pm,
        hint: pm === detected ? "detected" : undefined,
      })),
    }),
  );
}

export async function promptInstall(): Promise<boolean> {
  return ensure(await confirm({ message: "Install dependencies now?", initialValue: true }));
}
