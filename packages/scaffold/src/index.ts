#!/usr/bin/env node
import { basename, isAbsolute, resolve } from "node:path";

import { intro, log, note, outro, spinner } from "@clack/prompts";
import { Command } from "commander";

import { printLogo } from "./logo.ts";
import {
  promptInstall,
  promptPackageManager,
  promptProjectDir,
  promptTemplate,
} from "./prompts.ts";
import { installDependencies, isDirReusable, scaffold } from "./scaffold.ts";
import {
  detectPackageManager,
  PACKAGE_MANAGERS,
  runCommand,
  TEMPLATE_BY_FLAG,
  TEMPLATES,
} from "./templates.ts";

import type { PackageManager, TemplateDef } from "./templates.ts";

interface CliOptions {
  vike?: boolean;
  reactRouter?: boolean;
  tanstack?: boolean;
  next?: boolean;
  pm?: string;
  install?: boolean;
}

/** Resolve the chosen template from flags, or `undefined` to prompt. */
function templateFromFlags(opts: CliOptions): TemplateDef | undefined {
  const picked: string[] = [];
  if (opts.vike) picked.push("vike");
  if (opts.reactRouter) picked.push("react-router");
  if (opts.tanstack) picked.push("tanstack");
  if (opts.next) picked.push("next");

  if (picked.length > 1) {
    log.error(`Pick a single framework flag (got: ${picked.join(", ")}).`);
    process.exit(1);
  }
  const first = picked[0];
  if (first === undefined) return undefined;
  return TEMPLATE_BY_FLAG.get(first);
}

function resolvePackageManager(flag?: string): PackageManager {
  if (!flag) return detectPackageManager();
  if (!PACKAGE_MANAGERS.includes(flag as PackageManager)) {
    log.error(`Unknown package manager "${flag}". Use one of: ${PACKAGE_MANAGERS.join(", ")}.`);
    process.exit(1);
  }
  return flag as PackageManager;
}

async function run(dirArg: string | undefined, opts: CliOptions): Promise<void> {
  printLogo();
  intro("create-virtus-app");

  const interactive = !templateFromFlags(opts);

  const projectDir = dirArg ?? (interactive ? await promptProjectDir() : "./my-virtus-app");
  const targetDir = isAbsolute(projectDir) ? projectDir : resolve(process.cwd(), projectDir);
  const projectName = basename(targetDir);

  if (!(await isDirReusable(targetDir))) {
    log.error(`Target directory "${projectDir}" exists and is not empty.`);
    process.exit(1);
  }

  const template = templateFromFlags(opts) ?? (await promptTemplate());

  const wantsInstall = opts.install === false ? false : interactive ? await promptInstall() : true;
  const pm = opts.pm
    ? resolvePackageManager(opts.pm)
    : interactive
      ? await promptPackageManager()
      : detectPackageManager();

  const s = spinner();
  s.start(`Scaffolding ${template.label} project`);
  try {
    await scaffold({ targetDir, projectName, template });
    s.stop(`Created ${projectName} (${template.label})`);
  } catch (err) {
    s.stop("Scaffolding failed");
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (wantsInstall) {
    const s2 = spinner();
    s2.start(`Installing dependencies with ${pm}`);
    try {
      await installDependencies(pm, targetDir);
      s2.stop("Dependencies installed");
    } catch (err) {
      s2.stop("Install failed — you can run it manually");
      log.warn(err instanceof Error ? err.message : String(err));
    }
  }

  const steps = [
    `cd ${projectDir}`,
    ...(wantsInstall ? [] : [pm === "yarn" ? "yarn" : `${pm} install`]),
    runCommand(pm, template.devCommand),
  ];
  note(steps.join("\n"), "Next steps");
  outro(`Done. Happy hacking with ${template.label}! 🚀`);
}

const program = new Command();
program
  .name("create-virtus-app")
  .description("Scaffold a HyperDown + HyperJson app (Vike / React Router / TanStack / Next.js).")
  .argument("[dir]", "target directory")
  .option("--vike", "use the Vike template")
  .option("--react-router", "use the React Router v7 template")
  .option("--tanstack", "use the TanStack Start template")
  .option("--next", "use the Next.js template")
  .option("--pm <manager>", `package manager (${PACKAGE_MANAGERS.join(" | ")})`)
  .option("--no-install", "skip dependency installation")
  .addHelpText(
    "after",
    `\nTemplates:\n${TEMPLATES.map((t) => `  --${t.flag.padEnd(13)} ${t.hint}`).join("\n")}`,
  )
  .action((dir: string | undefined, opts: CliOptions) => run(dir, opts));

program.parseAsync(process.argv).catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
