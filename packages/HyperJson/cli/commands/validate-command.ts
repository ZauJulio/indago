import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as p from "@clack/prompts";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import { loadHyperJsonConfig } from "../../src/lib/config.ts";
import { validateContentSchemas } from "../../src/lib/validate.ts";
import { BaseCommand } from "./base-command.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ValidateOptions {
  /** Path to the file/dir matching the selected target. Ignored when target is "both". */
  path?: string;
}

export class ValidateCommand extends BaseCommand {
  private readonly ajv: Ajv;

  constructor() {
    super();
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  public async run(target: string | boolean, opts: ValidateOptions = {}): Promise<void> {
    await this.executeSafely(() => {
      const t = target === true ? "both" : target;
      let hasError = false;

      // --path applies only to a single explicit target; "both" uses defaults.
      if (t === "config" || t === "both") {
        hasError = this.validateConfig(t === "config" ? opts.path : undefined) || hasError;
      }

      if (t === "content" || t === "both") {
        hasError = this.validateContent(t === "content" ? opts.path : undefined) || hasError;
      }

      if (hasError) process.exit(1);
    });
  }

  private validateConfig(configPathOverride?: string): boolean {
    const configPath = resolve(process.cwd(), configPathOverride ?? "hyperjson.config.json");
    const schemaPath = resolve(__dirname, "../../schemas/hyperjson.config.schema.json");

    if (!existsSync(configPath)) {
      p.log.warning("hyperjson.config.json not found — skipping config validation.");
      return false;
    }

    if (!existsSync(schemaPath)) {
      p.log.warning("hyperjson.config.schema.json not found — skipping config validation.");
      return false;
    }

    return this.validateFile(configPath, schemaPath, "hyperjson.config.json");
  }

  private validateContent(contentDirOverride?: string): boolean {
    // Resolve the content dir from the current project's own config (relative to
    // cwd). This keeps standalone scaffolded projects from falling back to the
    // monorepo-oriented `resolveDefaultContentDir()`, which walks `cwd/../..`.
    // An explicit --path overrides the config-derived dir.
    const contentDir = contentDirOverride
      ? resolve(process.cwd(), contentDirOverride)
      : resolve(process.cwd(), loadHyperJsonConfig(process.cwd()).contentDir);

    const { passed, failed, results } = validateContentSchemas(contentDir);

    for (const r of results) {
      if (!r.valid) {
        p.log.error(`${r.file}:`);
        for (const e of r.errors ?? []) p.log.error(`  ${e}`);
      }
    }

    p.log.info(`Validation complete — ${passed} passed, ${failed} failed.`);
    return failed > 0;
  }

  private validateFile(dataPath: string, schemaPath: string, name: string): boolean {
    try {
      const data = JSON.parse(readFileSync(dataPath, "utf-8")) as unknown;
      const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as unknown;
      const validate = this.ajv.compile(schema as Parameters<Ajv["compile"]>[0]);
      const valid = validate(data);

      if (!valid) {
        p.log.error(`Invalid ${name}:`);

        for (const error of validate.errors ?? []) {
          p.log.error(`  ${error.instancePath} ${error.message}`);
        }

        return true;
      }

      p.log.success(`${name} is valid`);
      return false;
    } catch (err) {
      p.log.error(`Failed to validate ${name}: ${(err as Error).message}`);
      return true;
    }
  }
}
