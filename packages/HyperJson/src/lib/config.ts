import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv from "ajv";
import addFormats from "ajv-formats";

// The config schema lives at a single, fixed location in the package. Importing
// it directly lets the bundler inline it, so there is no runtime path
// resolution and no `dist/` vs `src/` layout guessing.
import configSchema from "../../schemas/hyperjson.config.schema.json" with { type: "json" };
import { validateLog } from "./logger.ts";

import type { HyperJsonConfiguration } from "./types.ts";

const DEFAULT_CONFIG: HyperJsonConfiguration = {
  contentDir: "src/content",
};

// Compiled once at module load — the schema never changes between calls.
const ajv = addFormats(new Ajv({ allErrors: true, verbose: true }));
const validateConfig = ajv.compile(configSchema);

export function validateHyperJsonConfig(
  config: unknown,
  configPath = "hyperjson.config.json",
): config is HyperJsonConfiguration {
  const valid = validateConfig(config);

  if (!valid) {
    validateLog.error(
      { file: configPath, errors: validateConfig.errors ?? [] },
      "HyperJson config validation failed",
    );
  }

  return Boolean(valid);
}

export function loadHyperJsonConfig(appRootDir: string): HyperJsonConfiguration {
  const configPath = resolve(appRootDir, "hyperjson.config.json");
  if (!existsSync(configPath)) return DEFAULT_CONFIG;

  const raw = JSON.parse(readFileSync(configPath, "utf-8")) as HyperJsonConfiguration;
  if (!validateHyperJsonConfig(raw, configPath)) {
    throw new Error(`[HyperJson] Invalid config at ${configPath}`);
  }

  return raw;
}
