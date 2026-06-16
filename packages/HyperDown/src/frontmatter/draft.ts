import type { FrontmatterField } from "./config.ts";

/**
 * Draft support.
 *
 * A content field declared with `type: "draft"` in `frontmatter.json` flags an
 * item as unpublished. When that field is truthy the item is excluded from:
 *   - the SQLite metadata + FTS index (the writer skips it),
 *   - the generated `import.meta.glob` body map (so its MD/MDX is **never
 *     compiled into the client bundle** — a draft can't be discovered by guessing
 *     its slug), and
 *   - the sitemap.
 *
 * The field **name is configurable**: it is whatever the `type: "draft"` field is
 * called (e.g. `draft`, `unpublished`, `wip`). A content type may even declare
 * several; an item is a draft if any of them is truthy.
 */

/** Names of the fields that act as the draft toggle for a content type. */
export function draftFieldNames(
  fields: readonly Pick<FrontmatterField, "name" | "type">[],
): string[] {
  return fields.filter((f) => f.type === "draft").map((f) => f.name);
}

/**
 * Whether a single frontmatter value marks the item as a draft. Accepts the YAML
 * boolean `true` (parsed frontmatter) and the string `"true"` (the sitemap's
 * line-based extractor yields strings) — but never `false`/`"false"`/absent.
 */
export function isDraftValue(value: unknown): boolean {
  return value === true || value === "true";
}

/** Whether parsed frontmatter marks the item as a draft, given the draft field names. */
export function isDraftData(
  data: Record<string, unknown>,
  draftFields: readonly string[],
): boolean {
  return draftFields.some((name) => isDraftValue(data[name]));
}
