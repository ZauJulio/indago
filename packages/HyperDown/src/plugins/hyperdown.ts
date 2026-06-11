import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HyperDownCodegen } from "../frontmatter/codegen";
import { writerLog } from "../utils/logger.server";
import { validateConfig } from "../utils/validator";

import type { FrontMatterTeamSettings } from "../frontmatter/schema-types";
import type { HyperDownConfiguration } from "../utils/types";
import type { ResolvedConfig } from "vite";

export interface HyperDownPluginOptions {
  configPath?: string;
}

const VIRTUAL_MODULE_ID = "virtual:hyperdown-config";
const RESOLVED_VIRTUAL_ID = "\0virtual:hyperdown-config";

const VIRTUAL_FRONTMATTER_ID = "virtual:hyperdown-frontmatter";
const RESOLVED_VIRTUAL_FRONTMATTER_ID = "\0virtual:hyperdown-frontmatter";

const VIRTUAL_COLLECTIONS_ID = "virtual:hyperdown-collections";
const RESOLVED_VIRTUAL_COLLECTIONS_ID = "\0virtual:hyperdown-collections";

const VIRTUAL_CONTENT_PREFIX = "virtual:hyperdown/";
const RESOLVED_VIRTUAL_CONTENT_PREFIX = "\0virtual:hyperdown/";

let _hyperdownRan = false;

export function hyperdownPlugin(options: HyperDownPluginOptions = {}) {
  let resolvedConfigPath: string;
  let hyperdownConfig: HyperDownConfiguration;
  let frontmatterConfig: FrontMatterTeamSettings = {};
  /** The build's `dist` root (parent of Vike's per-environment client/server dirs). */
  let distRoot: string;
  /** Only real builds copy `.db` files into dist — vitest/dev boot Vite with a
   *  throwaway outDir (vitest: `dummy-non-existing-folder`). */
  let isBuild = false;

  return {
    name: "vite-plugin-hyperdown",

    // Runs after Vite resolves its own config — gives us the vite.config.ts location
    configResolved(viteConfig: ResolvedConfig) {
      isBuild = viteConfig.command === "build";
      const viteConfigDir = dirname(viteConfig.configFile ?? resolve(process.cwd(), "vite.config"));

      // Vike builds into `dist/client` and `dist/server`; the shared root is their
      // parent. Fall back to the outDir itself for non-Vike single-output builds.
      const outDir = resolve(viteConfigDir, viteConfig.build.outDir);
      const outDirName = basename(outDir);
      distRoot = outDirName === "client" || outDirName === "server" ? dirname(outDir) : outDir;

      resolvedConfigPath = options.configPath
        ? resolve(process.cwd(), options.configPath)
        : resolve(viteConfigDir, "hyperdown.config.json");

      if (!existsSync(resolvedConfigPath)) {
        writerLog.error(`Config not found at: ${resolvedConfigPath}`);
        return;
      }

      // Parse once here — reused in virtual module and buildStart
      hyperdownConfig = JSON.parse(
        readFileSync(resolvedConfigPath, "utf-8"),
      ) as HyperDownConfiguration;

      const fmPath = hyperdownConfig.database?.frontmatterJsonPath;

      if (fmPath) {
        const absoluteFmPath = resolve(dirname(resolvedConfigPath), fmPath);
        if (existsSync(absoluteFmPath)) {
          frontmatterConfig = JSON.parse(readFileSync(absoluteFmPath, "utf-8"));
        }
      }

      process.env.HYPERDOWN_CONFIG_PATH = resolvedConfigPath;
      process.env.HYPERDOWN_BASE_DIR = viteConfigDir;
    },

    // ── Virtual module resolution ──────────────────────────────
    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
      if (id === VIRTUAL_FRONTMATTER_ID) return RESOLVED_VIRTUAL_FRONTMATTER_ID;
      if (id === VIRTUAL_COLLECTIONS_ID) return RESOLVED_VIRTUAL_COLLECTIONS_ID;
      if (id.startsWith(VIRTUAL_CONTENT_PREFIX)) {
        return RESOLVED_VIRTUAL_CONTENT_PREFIX + id.slice(VIRTUAL_CONTENT_PREFIX.length);
      }
      return null;
    },

    load(id: string) {
      if (id === RESOLVED_VIRTUAL_ID) {
        // Inject config as static ESM — tree-shakeable, typed, zero runtime cost
        return `export default ${JSON.stringify(hyperdownConfig)};`;
      }

      if (id === RESOLVED_VIRTUAL_FRONTMATTER_ID) {
        return `export default ${JSON.stringify(frontmatterConfig)};`;
      }

      if (id === RESOLVED_VIRTUAL_COLLECTIONS_ID) {
        const pageFolders = frontmatterConfig["frontMatter.content.pageFolders"] || [];

        let code = `export function getCollectionConfig(name) {\n  switch (name) {\n`;

        for (const folder of pageFolders) {
          const name = folder.contentTypes?.[0] || folder.title.toLowerCase();
          code += `    case '${name}': return import('${VIRTUAL_CONTENT_PREFIX}${name}');\n`;
        }

        code += `    default: throw new Error('[hyperdown] Unknown content type: ' + name);\n  }\n}\n`;

        return code;
      }

      if (id.startsWith(RESOLVED_VIRTUAL_CONTENT_PREFIX)) {
        const contentName = id.slice(RESOLVED_VIRTUAL_CONTENT_PREFIX.length);
        const dbConfig = (hyperdownConfig.database as Record<string, unknown>) || {};
        const pageFolders = frontmatterConfig["frontMatter.content.pageFolders"] || [];

        const folder = pageFolders.find(
          (f) => (f.contentTypes?.[0] || f.title.toLowerCase()) === contentName,
        );

        if (!folder) {
          throw new Error(
            `[hyperdown] Content type "${contentName}" not found in frontmatter.json`,
          );
        }

        const contentDir = (dbConfig.contentDir as string) || "src/content";

        // SSR-only: ship the raw `.db` as a build asset (`?url` → hashed path), read
        // from disk at request/prerender time. Absolute path so `?url` resolves anywhere.
        const dbAbsolutePath = resolve(
          dirname(resolvedConfigPath),
          contentDir,
          contentName,
          contentName + ".db",
        );

        // Escape backslashes for Windows paths in the generated JS
        const escapedPath = dbAbsolutePath.replace(/\\/g, "\\\\");

        return `
          import dbUrl from '${escapedPath}?url';
          export { dbUrl };
        `;
      }

      return null;
    },

    // ── Build step (unchanged) ─────────────────────────────────
    async buildStart() {
      if (_hyperdownRan) return;
      _hyperdownRan = true;

      writerLog.info("Validating config and generating SQLite database...");

      try {
        validateConfig(resolvedConfigPath);
      } catch {
        writerLog.error("Validation failed. Aborting database generation.");
        return;
      }

      // Codegen the app's `.hyper-down/**` before the writer runs (it skips db
      // creation otherwise). node:fs only, so it runs in-process.
      try {
        new HyperDownCodegen(process.env.HYPERDOWN_BASE_DIR).generate();
      } catch (err: unknown) {
        writerLog.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "Type codegen failed; continuing (writer may skip types).",
        );
      }

      const _dirname =
        typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

      // Writer script: `.ts` (source) or `.js` (dist/src/plugins → ../frontmatter).
      const tsCandidate = resolve(_dirname, "../frontmatter/writer.ts");
      const jsCandidate = resolve(_dirname, "../frontmatter/writer.js");
      const writerScriptPath = existsSync(tsCandidate) ? tsCandidate : jsCandidate;

      try {
        await new Promise<void>((resolvePromise, reject) => {
          const child = spawn("bun", [writerScriptPath, resolvedConfigPath], { stdio: "inherit" });

          child.on("close", (code) => {
            if (code === 0) resolvePromise();
            else reject(new Error(`Process exited with code ${code}`));
          });

          child.on("error", reject);
        });
      } catch (err: unknown) {
        writerLog.error(
          { err: err instanceof Error ? err.message : String(err) },
          "Database generation failed",
        );
      }
    },

    // Copy the generated `.db` files into `dist/metadata/` so the built `dist` is
    // self-contained (SSR deploy needs no source `content/`). Runs per build phase.
    closeBundle() {
      if (!isBuild || !distRoot) return;

      const contentDir = hyperdownConfig?.database?.contentDir;
      const pageFolders = frontmatterConfig["frontMatter.content.pageFolders"] || [];
      if (!contentDir || pageFolders.length === 0) return;

      const sourceDir = resolve(dirname(resolvedConfigPath), contentDir);
      const metadataDir = join(distRoot, "metadata");
      mkdirSync(metadataDir, { recursive: true });

      for (const folder of pageFolders) {
        const name = folder.contentTypes?.[0] || folder.title.toLowerCase();
        const sourceDb = join(sourceDir, name, `${name}.db`);
        if (existsSync(sourceDb)) copyFileSync(sourceDb, join(metadataDir, `${name}.db`));
      }
    },
  };
}
