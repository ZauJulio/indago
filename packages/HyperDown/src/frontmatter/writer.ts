import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { writerLog } from "../utils/logger.server.ts";
import { resolveConcurrency, runPool } from "../utils/pool.ts";
import { CollectionDbBuilder } from "./collection-db-builder.ts";
import { FrontmatterConfigManager, type FrontmatterJson } from "./config.ts";
import { FrontmatterParser } from "./parser.ts";
import { FrontmatterValidator } from "./validator.ts";

import type { FrontMatterPageFolder } from "./config.ts";
import type { IndexMode } from "./sections.ts";

/**
 * Orchestrates SQLite generation for every content collection declared in
 * `frontmatter.json`. It owns the shared parser/validator and resolves each
 * collection's paths, then delegates the actual build to a {@link
 * CollectionDbBuilder} per collection. Collections write independent `.db` files
 * (no shared SQLite write lock), so they run through a bounded pool.
 */
export class HyperDownWriter {
  private parser = new FrontmatterParser();
  private validator: FrontmatterValidator;

  constructor(
    private config: FrontmatterJson,
    private configDir: string,
    /** Relative path from configDir to the frontmatter.json file. */
    fmJsonPath = "../../frontmatter.json",
    /** `database.contentDir` (relative to configDir). */
    private contentDir = "./src/content",
    /** `database.index` / `database.indexByCollection` — the indexing granularity. */
    private indexConfig: {
      index?: IndexMode;
      indexByCollection?: Record<string, IndexMode>;
    } = {},
  ) {
    const configManager = new FrontmatterConfigManager(resolve(configDir, fmJsonPath));
    this.validator = new FrontmatterValidator(configManager, resolve(configDir, "../.."));
  }

  /** Resolves a collection's index mode: per-collection override → global → `"page"`. */
  private resolveIndexMode(name: string): IndexMode {
    return this.indexConfig.indexByCollection?.[name] ?? this.indexConfig.index ?? "page";
  }

  public async writeDatabases(): Promise<void> {
    const contentDir = resolve(this.configDir, this.contentDir);
    const pageFolders = this.config["frontMatter.content.pageFolders"] || [];
    const defaultLocale = pageFolders[0]?.defaultLocale || "en";
    const concurrency = resolveConcurrency();

    const builders = pageFolders
      .map((folder) => this.createBuilder(folder, contentDir, defaultLocale))
      .filter((builder): builder is CollectionDbBuilder => builder !== null);

    // Collections write independent `.db` files, so they run through a bounded
    // pool — while one awaits its file reads, another proceeds.
    await runPool(
      builders.map((builder) => () => builder.build(concurrency)),
      concurrency,
    );
  }

  /**
   * Resolves one collection's paths and returns a builder for it — or `null` when
   * the type's generated `types.ts` is missing (codegen hasn't run) or the
   * content type is absent from `frontmatter.json`.
   */
  private createBuilder(
    folder: FrontMatterPageFolder,
    contentDir: string,
    defaultLocale: string,
  ): CollectionDbBuilder | null {
    const name = folder.contentTypes?.[0] || folder.title.toLowerCase();
    const targetDir = join(contentDir, name);

    // Ensure the directory exists — a type may be declared before any content
    // files are added.
    mkdirSync(targetDir, { recursive: true });

    // Codegen writes types under `.hyper-down/<contentDir>/<name>/types.ts`, where
    // <contentDir> mirrors `database.contentDir` minus the leading `./`. Without
    // them the table can't be built, so skip until codegen has run.
    const contentDirRel = this.contentDir.replace(/^\.\//, "");
    const schemaPath = resolve(this.configDir, ".hyper-down", contentDirRel, name, "types.ts");
    if (!existsSync(schemaPath)) {
      writerLog.warn(`Types not found for ${name}. Run code generation first.`);
      return null;
    }

    const contentType = this.config["frontMatter.taxonomy.contentTypes"]?.find((c) =>
      folder.contentTypes?.includes(c.name as string),
    );
    if (!contentType) return null;

    return new CollectionDbBuilder(
      {
        name,
        contentType,
        targetDir,
        dbPath: join(targetDir, `${name}.db`),
        defaultLocale,
        index: this.resolveIndexMode(name),
      },
      this.parser,
      this.validator,
    );
  }
}

if (import.meta.main) {
  const configPath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(process.cwd(), "hyperdown.config.json");

  const configDir = resolve(configPath, "..");

  // load configs
  const hyperdownConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  const fmPath = hyperdownConfig.database?.frontmatterJsonPath || "../../frontmatter.json";
  const frontmatterConfig = JSON.parse(readFileSync(resolve(configDir, fmPath), "utf-8"));

  const writer = new HyperDownWriter(
    frontmatterConfig,
    configDir,
    fmPath,
    hyperdownConfig.database?.contentDir,
    {
      index: hyperdownConfig.database?.index,
      indexByCollection: hyperdownConfig.database?.indexByCollection,
    },
  );
  await writer.writeDatabases();
}
