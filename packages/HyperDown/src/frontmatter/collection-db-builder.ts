import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { basename, join, sep } from "node:path";

import { Database } from "bun:sqlite";

import { writerLog } from "../utils/logger.server.ts";
import { runPool } from "../utils/pool.ts";
import { CollectionSchema } from "./collection-schema.ts";
import { draftFieldNames, isDraftData } from "./draft.ts";
import { extractSectionRecords, parseSections } from "./sections.ts";

import type { TypedFrontMatterContentType } from "./config.ts";
import type { FrontmatterParser } from "./parser.ts";
import type { IndexMode, SectionNode, SectionRecord } from "./sections.ts";
import type { FrontmatterValidator } from "./validator.ts";
import { readFile } from "node:fs/promises";

/** Bind-parameter object accepted by a bun:sqlite prepared statement. */
type BindParams = Record<string, string | number | boolean | null>;

/** A file's read+parsed+validated payload, ready to persist (Phase 1 output). */
interface PreparedRow {
  slug: string;
  locale: string;
  data: Record<string, unknown>;
  content: string;
  /** Heading tree (composed mode only) — serialised into the `sections` column. */
  sectionTree?: SectionNode[];
  /** Flattened heading+body records (composed mode only) — fed to the sections FTS. */
  sectionRecords?: SectionRecord[];
}

/** Everything `CollectionDbBuilder` needs to build one collection's `.db`. */
export interface CollectionBuildContext {
  /** Content-type name (e.g. `"article"`), used for table/file names. */
  name: string;
  /** The content type's field definitions. */
  contentType: TypedFrontMatterContentType;
  /** Absolute directory holding the collection's `.md`/`.mdx` files. */
  targetDir: string;
  /** Absolute path of the `.db` to (re)generate. */
  dbPath: string;
  /** Locale assigned to files at the content root (no locale subfolder). */
  defaultLocale: string;
  /** `"composed"` enables per-section FTS + a stored heading tree. */
  index: IndexMode;
}

/**
 * Builds a single content collection's SQLite database.
 *
 * Two phases: **Phase 1** reads + parses + validates every file through a bounded
 * pool (async I/O overlaps); **Phase 2** persists the prepared rows serially in
 * one transaction. SQLite serializes writes, so the fill is serial by design —
 * the parallelism lives entirely in Phase 1. SQL generation is delegated to
 * {@link CollectionSchema}; this class only orchestrates reads and execution.
 */
export class CollectionDbBuilder {
  private readonly schema: CollectionSchema;
  /** Names of the `type: "draft"` fields — items with any of them truthy are skipped. */
  private readonly draftFields: string[];

  constructor(
    private readonly ctx: CollectionBuildContext,
    private readonly parser: FrontmatterParser,
    private readonly validator: FrontmatterValidator,
  ) {
    this.schema = new CollectionSchema(ctx.name, ctx.contentType.fields, ctx.index);
    this.draftFields = draftFieldNames(ctx.contentType.fields);
  }

  /** Runs Phase 1 (parallel prepare) then Phase 2 (serial persist). */
  async build(concurrency: number): Promise<void> {
    const rows = await this.prepareRows(concurrency);
    this.persist(rows);
  }

  // ── Phase 1: parallel read + parse + validate ───────────────────────────────

  private async prepareRows(concurrency: number): Promise<PreparedRow[]> {
    const files = readdirSync(this.ctx.targetDir, { recursive: true }).filter(
      (f) => typeof f === "string" && (f.endsWith(".md") || f.endsWith(".mdx")),
    ) as string[];

    const prepared = await runPool(
      files.map((file) => () => this.prepareRow(file)),
      concurrency,
    );

    return prepared.filter((row): row is PreparedRow => row !== null);
  }

  /** Reads, parses and validates one file. `null` ⇒ skipped (no title / invalid). */
  private async prepareRow(file: string): Promise<PreparedRow | null> {
    const filePath = join(this.ctx.targetDir, file);
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = this.parser.parse(raw);

    // Drafts are skipped entirely (before validation) so unpublished, possibly
    // incomplete items never reach the index — and never log validation noise.
    if (this.draftFields.length > 0 && isDraftData(data, this.draftFields)) return null;

    if (!data.title) return null;

    const { isValid, errors } = this.validator.validate(data, filePath);
    if (!isValid) {
      writerLog.error(
        `Skipping ${file} due to invalid frontmatter. Errors: ${JSON.stringify(errors)}`,
      );
      return null;
    }

    return {
      slug: (data.slug as string) || this.deriveSlug(file),
      locale: this.detectLocale(file),
      data,
      content,
      // Parse the heading tree once here (Phase 1) so the serial persist stays cheap.
      ...(this.schema.isComposed
        ? { sectionTree: parseSections(content), sectionRecords: extractSectionRecords(content) }
        : {}),
    };
  }

  // ── Phase 2: serial persist in one transaction ──────────────────────────────

  private persist(rows: PreparedRow[]): void {
    if (existsSync(this.ctx.dbPath)) unlinkSync(this.ctx.dbPath);
    // Clean up any stale `.db.gz` left by an older (CSR) build.
    if (existsSync(`${this.ctx.dbPath}.gz`)) unlinkSync(`${this.ctx.dbPath}.gz`);

    writerLog.info(`Generating SQLite database for ${this.ctx.name}`);
    const db = new Database(this.ctx.dbPath, { create: true });

    try {
      this.createSchema(db);
      this.insertRows(db, rows);
      for (const sql of this.schema.createIndexSqls()) db.query(sql).run();
      db.query("VACUUM;").run();
    } finally {
      db.close();
    }

    // SSR-only: the raw `.db` is read directly from disk by server loaders.
  }

  private createSchema(db: Database): void {
    db.query(this.schema.createTableSql()).run();
    db.query(this.schema.createFtsSql()).run();

    const tagsTableSql = this.schema.createTagsTableSql();
    if (tagsTableSql) db.query(tagsTableSql).run();

    const sectionsTableSql = this.schema.createSectionsTableSql();
    if (sectionsTableSql) db.query(sectionsTableSql).run();

    const sectionsFtsSql = this.schema.createSectionsFtsSql();
    if (sectionsFtsSql) db.query(sectionsFtsSql).run();
  }

  /** Inserts every prepared row into the main, FTS and bridge tables, wrapped in
   *  a single transaction — otherwise each INSERT pays its own fsync (O(n) slow). */
  private insertRows(db: Database, rows: PreparedRow[]): void {
    const metaStmt = db.prepare(this.schema.insertRowSql());
    const ftsStmt = db.prepare(this.schema.insertFtsSql());
    const tagSql = this.schema.insertTagSql();
    const tagStmt = tagSql ? db.prepare(tagSql) : null;

    const sectionSql = this.schema.insertSectionSql();
    const sectionStmt = sectionSql ? db.prepare(sectionSql) : null;
    const sectionFtsSql = this.schema.insertSectionFtsSql();
    const sectionFtsStmt = sectionFtsSql ? db.prepare(sectionFtsSql) : null;

    db.query("BEGIN").run();
    for (const row of rows) {
      const { id } = metaStmt.get(this.metaParams(row)) as { id: number };
      ftsStmt.run(this.ftsParams(id, row));

      if (tagStmt) {
        for (const params of this.tagParams(id, row)) tagStmt.run(params);
      }

      if (sectionStmt && sectionFtsStmt) {
        for (const record of row.sectionRecords ?? []) {
          const { id: sectionId } = sectionStmt.get({
            $cid: id,
            $slug: row.slug,
            $locale: row.locale,
            $heading_id: record.id,
            $title: record.title,
            $level: record.level,
          }) as { id: number };
          sectionFtsStmt.run({ $rowid: sectionId, $title: record.title, $body: record.body });
        }
      }
    }
    db.query("COMMIT").run();
  }

  // ── Pure bind-parameter builders ────────────────────────────────────────────

  private metaParams(row: PreparedRow): BindParams {
    const params: Record<string, unknown> = { $slug: row.slug, $locale: row.locale };

    for (const field of this.ctx.contentType.fields) {
      const val = row.data[field.name];
      params[`$${field.name}`] =
        field.type === "tags" || field.type === "categories"
          ? JSON.stringify(val || [])
          : (val ?? null);
    }

    if (this.schema.isComposed) params.$sections = JSON.stringify(row.sectionTree ?? []);

    return params as BindParams;
  }

  private ftsParams(id: number, row: PreparedRow): BindParams {
    const params: Record<string, unknown> = { $content_rowid: id };
    // Composed collections' page FTS has no `body` column (the body lives in the
    // section FTS) — binding `$body` would error against the narrower statement.
    if (this.schema.pageFtsHasBody) params.$body = row.content;

    for (const column of this.schema.ftsColumns) {
      const val = row.data[column];
      params[`$${column}`] = this.schema.isArrayFtsColumn(column)
        ? Array.isArray(val)
          ? val.join(" ")
          : String(val || "")
        : val || "";
    }

    return params as BindParams;
  }

  private tagParams(id: number, row: PreparedRow): BindParams[] {
    const params: BindParams[] = [];

    for (const field of this.schema.arrayFields) {
      const val = row.data[field];
      if (!Array.isArray(val)) continue;

      for (const entry of val) {
        params.push({ $cid: id, $field: field, $value: String(entry) });
      }
    }

    return params;
  }

  // ── File-name conventions ───────────────────────────────────────────────────

  private deriveSlug(file: string): string {
    return basename(file).replace(/\.mdx?$/, "");
  }

  /** A locale subfolder (e.g. `pt-BR/post.mdx`) names the locale; root files use
   *  the collection's default locale. */
  private detectLocale(file: string): string {
    const parts = file.split(sep);
    return parts.length > 1 ? parts[0] : this.ctx.defaultLocale;
  }
}
