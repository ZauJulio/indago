import type { FrontmatterField } from "./config.ts";
import type { IndexMode } from "./sections.ts";

/**
 * Derives every SQL statement for one content collection from its field
 * definitions. It is **pure** — it produces SQL strings and column metadata but
 * never touches a database, separating "what the schema is" from "how it runs"
 * (the `CollectionDbBuilder` executes it).
 */
export class CollectionSchema {
  /** Frontmatter columns indexed by FTS (every non-draft, non-datetime field). */
  readonly ftsColumns: string[];
  /** Fields whose values are arrays (tags/categories), stored in the bridge. */
  readonly arrayFields: string[];

  /** `name TYPE` column definitions for the main table. */
  private readonly columnDefs: string[];
  /** FTS columns whose source value is an array (flattened to space tokens). */
  private readonly arrayFtsColumns: Set<string>;

  constructor(
    readonly name: string,
    private readonly fields: FrontmatterField[],
    /** `"composed"` adds a `sections` tree column + per-section FTS tables. */
    private readonly index: IndexMode = "page",
  ) {
    this.columnDefs = fields.map((f) => `${f.name} ${f.type === "draft" ? "INTEGER" : "TEXT"}`);
    this.ftsColumns = fields
      .filter((f) => f.type !== "draft" && f.type !== "datetime")
      .map((f) => f.name);
    this.arrayFields = fields
      .filter((f) => f.type === "tags" || f.type === "categories")
      .map((f) => f.name);
    // Every array field that also lands in an FTS column must be flattened to
    // tokens (tags AND categories) — binding a raw array throws in bun:sqlite.
    this.arrayFtsColumns = new Set(this.ftsColumns.filter((c) => this.arrayFields.includes(c)));
  }

  get ftsTable(): string {
    return `${this.name}_fts`;
  }

  get tagsTable(): string {
    return `${this.name}_tags`;
  }

  get sectionsTable(): string {
    return `${this.name}_sections`;
  }

  get sectionsFtsTable(): string {
    return `${this.name}_sections_fts`;
  }

  get hasArrayFields(): boolean {
    return this.arrayFields.length > 0;
  }

  /** `true` when section-level (`"composed"`) indexing is enabled for this collection. */
  get isComposed(): boolean {
    return this.index === "composed";
  }

  /** Whether this FTS column's value must be flattened from an array to tokens. */
  isArrayFtsColumn(column: string): boolean {
    return this.arrayFtsColumns.has(column);
  }

  createTableSql(): string {
    // `"composed"` stores the heading tree (JSON) so detail loaders can hand a
    // sidebar its sections without re-parsing the body. Only present when enabled.
    const sectionsCol = this.isComposed ? ", sections TEXT" : "";
    return (
      `CREATE TABLE IF NOT EXISTS ${this.name} ` +
      `(id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, locale TEXT NOT NULL, ` +
      `${this.columnDefs.join(", ")}${sectionsCol}, UNIQUE(slug, locale));`
    );
  }

  /** Per-section metadata (one row per heading) — joined to FTS hits for anchors. */
  createSectionsTableSql(): string | null {
    if (!this.isComposed) return null;
    return (
      `CREATE TABLE IF NOT EXISTS ${this.sectionsTable} ` +
      `(id INTEGER PRIMARY KEY AUTOINCREMENT, content_id INTEGER NOT NULL, ` +
      `slug TEXT NOT NULL, locale TEXT NOT NULL, heading_id TEXT NOT NULL, ` +
      `title TEXT NOT NULL, level INTEGER NOT NULL);`
    );
  }

  /** Contentless FTS over each section's title + body — section-level MATCH. */
  createSectionsFtsSql(): string | null {
    if (!this.isComposed) return null;
    return (
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${this.sectionsFtsTable} ` +
      `USING fts5(title, body, content="", tokenize="unicode61");`
    );
  }

  /** Whether the page FTS carries a `body` column. Composed collections index the
   *  body once — in the per-section FTS — so their page FTS is frontmatter-only. */
  get pageFtsHasBody(): boolean {
    return !this.isComposed;
  }

  /** Contentless FTS5 (content="") stores only the inverted index — not the
   *  original text — keeping the `.db` compact. A `body` column indexes the
   *  MD/MDX body so search reaches article content, not just frontmatter — but
   *  **composed** collections drop it: the body is tokenized once in the section
   *  FTS instead (no double-indexing), and `search()` reaches it from there. */
  createFtsSql(): string {
    const bodyCol = this.pageFtsHasBody ? ", body" : "";
    return (
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${this.ftsTable} ` +
      `USING fts5(${this.ftsColumns.join(", ")}${bodyCol}, content="", tokenize="unicode61");`
    );
  }

  /** Bridge table for array fields — one row per (content, field, value) makes
   *  membership filters sargable (indexed) instead of a `LIKE '%"x"%'` scan. */
  createTagsTableSql(): string | null {
    if (!this.hasArrayFields) return null;
    return (
      `CREATE TABLE IF NOT EXISTS ${this.tagsTable} ` +
      `(content_id INTEGER NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL);`
    );
  }

  insertRowSql(): string {
    const names = this.fields.map((f) => f.name);
    const placeholders = names.map((n) => `$${n}`).join(", ");
    const sectionsCol = this.isComposed ? ", sections" : "";
    const sectionsVal = this.isComposed ? ", $sections" : "";
    return (
      `INSERT INTO ${this.name} (slug, locale, ${names.join(", ")}${sectionsCol}) ` +
      `VALUES ($slug, $locale, ${placeholders}${sectionsVal}) RETURNING id;`
    );
  }

  insertSectionSql(): string | null {
    if (!this.isComposed) return null;
    return (
      `INSERT INTO ${this.sectionsTable} (content_id, slug, locale, heading_id, title, level) ` +
      `VALUES ($cid, $slug, $locale, $heading_id, $title, $level) RETURNING id;`
    );
  }

  insertSectionFtsSql(): string | null {
    if (!this.isComposed) return null;
    return `INSERT INTO ${this.sectionsFtsTable} (rowid, title, body) VALUES ($rowid, $title, $body);`;
  }

  insertFtsSql(): string {
    const placeholders = this.ftsColumns.map((c) => `$${c}`).join(", ");
    const bodyCol = this.pageFtsHasBody ? ", body" : "";
    const bodyVal = this.pageFtsHasBody ? ", $body" : "";
    return (
      `INSERT INTO ${this.ftsTable} (rowid, ${this.ftsColumns.join(", ")}${bodyCol}) ` +
      `VALUES ($content_rowid, ${placeholders}${bodyVal});`
    );
  }

  insertTagSql(): string | null {
    if (!this.hasArrayFields) return null;
    return `INSERT INTO ${this.tagsTable} (content_id, field, value) VALUES ($cid, $field, $value);`;
  }

  /** `UNIQUE(slug, locale)` already autoindexes `slug` (leftmost), and the composite
   *  `(locale, <col>)` indexes are `locale`-leftmost (covering bare `locale = ?`), so
   *  standalone `(slug)`/`(locale)` indexes would be redundant. We index only
   *  `(locale, <sortKey | facet>)`: `title`, datetime (date sort), choice (facet). */
  createIndexSqls(): string[] {
    const sqls = [
      `CREATE INDEX IF NOT EXISTS idx_${this.name}_locale_title ON ${this.name}(locale, title);`,
    ];

    for (const field of this.fields) {
      if (field.type === "datetime" || field.type === "choice") {
        sqls.push(
          `CREATE INDEX IF NOT EXISTS idx_${this.name}_locale_${field.name} ON ${this.name}(locale, ${field.name});`,
        );
      }
    }

    if (this.hasArrayFields) {
      sqls.push(
        `CREATE INDEX IF NOT EXISTS idx_${this.name}_tags ON ${this.tagsTable}(field, value);`,
      );
    }

    if (this.isComposed) {
      // FTS rowid → section row is by PK; the `(slug, locale)` index serves the
      // "sections of one article" lookup the sidebar/`#`-search rely on.
      sqls.push(
        `CREATE INDEX IF NOT EXISTS idx_${this.sectionsTable}_slug ON ${this.sectionsTable}(slug, locale);`,
      );
    }

    return sqls;
  }
}
