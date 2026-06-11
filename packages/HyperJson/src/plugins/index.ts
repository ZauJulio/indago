import { dirname, resolve } from "node:path";

import { HyperJsonCodegen } from "../codegen.js";
import { loadHyperJsonConfig } from "../lib/config.ts";
import { pluginLog } from "../lib/logger.ts";
import { validateContentSchemas } from "../lib/validate.ts";

import type { HyperJsonConfiguration } from "../lib/types.ts";
import type { ResolvedConfig } from "vite";

const VIRTUAL_CONFIG_ID = "virtual:hyperjson-config";
const RESOLVED_VIRTUAL_CONFIG_ID = "\0virtual:hyperjson-config";

let _hyperjsonRan = false;

/** Vite plugin that validates JSON content schemas and generates TypeScript types. */
export function hyperjsonValidationPlugin(contentDir?: string) {
  let appRoot = "";
  let hyperjsonConfig: HyperJsonConfiguration | undefined;

  return {
    name: "vite-plugin-hyperjson",

    // Runs after Vite resolves its own config — gives us the app root directory.
    configResolved(viteConfig: ResolvedConfig) {
      appRoot = dirname(viteConfig.configFile ?? resolve(process.cwd(), "vite.config"));
      hyperjsonConfig = loadHyperJsonConfig(appRoot);
    },

    // ── Virtual module resolution ──────────────────────────────────────────
    resolveId(id: string) {
      if (id === VIRTUAL_CONFIG_ID) return RESOLVED_VIRTUAL_CONFIG_ID;
      return null;
    },

    load(id: string) {
      if (id === RESOLVED_VIRTUAL_CONFIG_ID) {
        // Inject config as static ESM — available in both build and dev modes.
        return `export default ${JSON.stringify(hyperjsonConfig ?? { contentDir: "src/content" })};`;
      }
      return null;
    },

    // ── Build step ────────────────────────────────────────────────────────
    async buildStart() {
      if (_hyperjsonRan) return;
      _hyperjsonRan = true;

      const resolvedContentDir = contentDir ?? hyperjsonConfig?.contentDir ?? "src/content";
      const dir = resolve(appRoot, resolvedContentDir);
      const { passed, failed } = validateContentSchemas(dir);

      if (failed > 0) {
        pluginLog.error(
          { passed, failed },
          `${failed}/${passed + failed} JSON files FAILED validation.`,
        );
        process.exit(1);
      }

      pluginLog.info(`All ${passed} JSON files validated successfully.`);

      const codegen = new HyperJsonCodegen({ appRootDir: appRoot });
      await codegen.generate();
    },
  };
}
