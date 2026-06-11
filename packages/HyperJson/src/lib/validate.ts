import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import Ajv from "ajv";
import addFormats from "ajv-formats";

import { loadHyperJsonConfig } from "./config.ts";
import { validateLog } from "./logger.ts";

/** Result of validating a single JSON file against its schema. */
export interface ValidationResult {
  /** Absolute path to the validated JSON file. */
  file: string;
  /** Whether the file passed validation. */
  valid: boolean;
  /** Human-readable error messages, present only when `valid` is `false`. */
  errors?: string[];
}

/** Locale subdirectories scanned for JSON content files. */
const LOCALE_DIRS = ["en", "pt-BR"] as const;

/**
 * Resolves the default content directory by scanning the monorepo for a
 * `tsconfig.json` that defines an `@content/*` path alias pointing to
 * `./src/content/`. Falls back to `{cwd}/src/content` if none is found.
 */
export function resolveDefaultContentDir(): string {
  const repoRoot = resolve(process.cwd(), "../..");
  const appRoots: string[] = [];

  const walk = (dir: string, depth = 0): void => {
    if (depth > 4) return;

    let dirEntries;
    try {
      dirEntries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // Skip directories we cannot read (e.g. EACCES on system temp dirs).
      return;
    }

    for (const entry of dirEntries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
        continue;
      }

      const entryPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(entryPath, depth + 1);
        continue;
      }

      if (entry.isFile() && entry.name === "tsconfig.json") {
        try {
          const tsconfig = JSON.parse(readFileSync(entryPath, "utf-8")) as {
            compilerOptions?: { paths?: Record<string, string[]> };
          };
          const contentPaths = tsconfig.compilerOptions?.paths?.["@content/*"];

          if (
            Array.isArray(contentPaths) &&
            contentPaths.some(
              (target) => typeof target === "string" && target.includes("./src/content/"),
            )
          ) {
            appRoots.push(dirname(entryPath));
          }
        } catch {
          // Ignore malformed tsconfig files and continue scanning.
        }
      }
    }
  };

  walk(repoRoot);

  const appRoot = appRoots[0];
  if (!appRoot) return resolve(process.cwd(), "src/content");

  const hyperjsonConfig = loadHyperJsonConfig(appRoot);
  return resolve(appRoot, hyperjsonConfig.contentDir);
}

/**
 * Returns the immediate child directories of `dir`.
 * Each directory is expected to represent a content category.
 */
function getContentDirs(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => statSync(join(dir, entry)).isDirectory())
    .map((entry) => join(dir, entry));
}

/**
 * Loads and parses a JSON file from the given path.
 * Throws if the file cannot be read or parsed.
 */
function loadSchema(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

/**
 * Validates a single JSON file against a JSON Schema using AJV.
 * Returns a `ValidationResult` describing success or failure.
 */
function validateFile(jsonPath: string, schemaPath: string, ajv: Ajv): ValidationResult {
  try {
    const schema = loadSchema(schemaPath);
    const data = loadSchema(jsonPath);

    // Remove the $schema key before validation (it's not part of the data shape)
    const { $schema: _ignored, ...clean } = data;

    const validate = ajv.compile(schema);
    const valid = validate(clean);

    const errors = valid
      ? undefined
      : (validate.errors ?? []).map(
          (e) =>
            `${e.instancePath} ${e.message}${e.params ? ` (${JSON.stringify(e.params)})` : ""}`,
        );

    return { file: jsonPath, valid, errors };
  } catch (err) {
    return { file: jsonPath, valid: false, errors: [(err as Error).message] };
  }
}

/**
 * Collects all JSON content files in a content category directory.
 * Scans `en/` and `pt-BR/` locale subdirectories as well as the root dir,
 * excluding `schema.json`.
 */
function findJsonFiles(dir: string): string[] {
  const files: string[] = [];

  for (const locale of LOCALE_DIRS) {
    const localeDir = join(dir, locale);
    if (!existsSync(localeDir)) continue;

    const entries = readdirSync(localeDir).filter((f) => f.endsWith(".json"));
    for (const entry of entries) {
      files.push(join(localeDir, entry));
    }
  }

  // Also include non-locale JSON files at the category root
  const rootEntries = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "schema.json");
  for (const entry of rootEntries) {
    files.push(join(dir, entry));
  }

  return files;
}

/** Summary result returned by `validateContentSchemas`. */
export interface ContentValidationSummary {
  passed: number;
  failed: number;
  results: ValidationResult[];
  /** Absolute paths to directories that contain a `schema.json` file. */
  schemaDirs: string[];
}

/**
 * Validates all JSON content files in `contentDir` against their respective
 * `schema.json` files. Logs errors for each failing file.
 *
 * @param contentDir - Root content directory. Defaults to the auto-resolved dir.
 */
export function validateContentSchemas(
  contentDir = resolveDefaultContentDir(),
): ContentValidationSummary {
  const resolvedDir = resolve(contentDir);
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);

  const results: ValidationResult[] = [];

  let passed = 0;
  let failed = 0;

  const schemaDirs: string[] = [];

  for (const dir of getContentDirs(resolvedDir)) {
    const schemaPath = join(dir, "schema.json");
    if (!existsSync(schemaPath)) continue;

    schemaDirs.push(dir);

    for (const jsonPath of findJsonFiles(dir)) {
      const result = validateFile(jsonPath, schemaPath, ajv);
      results.push(result);

      if (result.valid) {
        passed++;
      } else {
        failed++;
        validateLog.error({ file: jsonPath, errors: result.errors }, "Validation failed");
      }
    }
  }

  return { passed, failed, results, schemaDirs };
}
