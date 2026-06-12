/**
 * Content codegen for the Next.js template (run as `predev` / `prebuild`).
 *
 * HyperDown's Next adapter (`@muttum/hyper-down/next`) does its half — type
 * codegen, the SQLite writer, the Next-compatible `modules.ts` rewrite and the
 * `.db` copy into `metadata/`. HyperJson then runs its own validate + generate;
 * the two engines are independent, so they are invoked separately here.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { runHyperDownNextCodegen } from "@muttum/hyper-down/next";

const root = process.cwd();

runHyperDownNextCodegen({ root });

const hyperjsonBin = join(root, "node_modules", "@muttum/hyper-json/dist/bin/hyperjson.js");
if (existsSync(hyperjsonBin)) {
  for (const cmd of ["validate", "generate"] as const) {
    const res = spawnSync("bun", [hyperjsonBin, cmd], { stdio: "inherit", cwd: root });
    if (res.status !== 0) process.exit(res.status ?? 1);
  }
}

process.stdout.write("✓ content codegen complete\n");
