import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import addFormats from "ajv-formats";

import { log } from "./logger.server.ts";

export function validateConfig(configPath: string) {
  const _dirname =
    typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
  const schemaPath = resolve(_dirname, "../../schemas/hyperdown.config.schema.json");

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const valid = validate(config);

    if (!valid) {
      log.error("❌ Invalid hyperdown.config.json:");

      for (const error of validate.errors ?? []) {
        log.error(`  - ${error.instancePath} ${error.message}`);
      }

      throw new Error("Config validation failed");
    }

    // Cross-validate with frontmatter.json
    const typedConfig = config as Record<string, unknown>;
    const databaseConfig = typedConfig.database as Record<string, unknown> | undefined;
    const fmPath = (databaseConfig?.frontmatterJsonPath as string) || "../../frontmatter.json";
    const absFmPath = resolve(dirname(configPath), fmPath);
    if (existsSync(absFmPath)) {
      const fmConfig = JSON.parse(readFileSync(absFmPath, "utf-8"));
      const fmTypes = fmConfig["frontMatter.taxonomy.contentTypes"] || [];
      const fmTypeNames = fmTypes.map((t: Record<string, unknown>) => String(t.name));

      const configTypes =
        ((typedConfig.sitemap as Record<string, unknown>)?.contentTypes as Record<
          string,
          unknown
        >[]) || [];
      for (const ct of configTypes) {
        if (!fmTypeNames.includes(ct.name)) {
          log.error(
            `❌ Content type '${ct.name}' found in hyperdown.config.json but missing from frontmatter.json`,
          );
          throw new Error(
            "Config validation failed due to missing content type in frontmatter.json",
          );
        }
      }
    }

    log.info("✅ hyperdown.config.json is valid");

    return config;
  } catch (err: unknown) {
    log.error(`❌ Failed to validate config: ${(err as Error).message}`);
    throw err;
  }
}
