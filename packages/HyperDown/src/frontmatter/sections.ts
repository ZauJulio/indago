import GithubSlugger from "github-slugger";

// ─────────────────────────────────────────────────────────────────────────────
//  Section parsing (pure) — the structure that powers "composed" indexing and
//  tutorial sidebars.
//
//  A document's headings (ATX `#`..`######`) become a nested tree. Each heading
//  may carry inline badges with the syntax `#[label/#color]`, e.g.
//  `## Setup #[beta/#000000]` — the badge is stripped from the title (and from
//  the anchor slug) and surfaced separately so a sidebar can render a pill.
//
//  Anchors are produced with `github-slugger`, the exact algorithm `rehype-slug`
//  uses, so the ids here match the `id` attributes rendered into the MDX body.
// ─────────────────────────────────────────────────────────────────────────────

/** Indexing granularity for a collection (see `hyperdown.config.json#database.index`). */
export type IndexMode = "page" | "composed";

/** A heading badge declared with `#[label/#color]`. `color` keeps its raw form (e.g. `#000000`). */
export interface SectionBadge {
  label: string;
  color: string;
}

/** One heading in the document tree. `id` is the anchor (matches `rehype-slug`). */
export interface SectionNode {
  /** Anchor id — slug of the badge-stripped, markdown-stripped title. */
  id: string;
  /** Display title (badges + inline markdown removed). */
  title: string;
  /** Heading depth, 1 (`#`) … 6 (`######`). */
  level: number;
  /** `true` when the heading text is emphasised with `**bold**`/`__bold__`. */
  bold: boolean;
  /** Badges parsed from the heading, in source order. */
  badges: SectionBadge[];
  /** Nested subsections (deeper headings until a sibling/shallower one). */
  children: SectionNode[];
}

/** A flattened heading plus the body text beneath it — the unit indexed by FTS in composed mode. */
export interface SectionRecord {
  id: string;
  title: string;
  level: number;
  /** Plain-ish text from just after the heading until the next heading (any level). */
  body: string;
}

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
/** `#[label/#color]` — label has no `]`/`/`; color has no `]`. */
const BADGE = /#\[([^\]/]+)\/([^\]]+)\]/g;
const BOLD = /(\*\*|__)(.+?)\1/;

/** Removes inline markdown so a heading's text matches its rendered text content. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → label
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/(\*|_)(.+?)\1/g, "$2") // italic
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .trim();
}

/** Pulls every `#[label/#color]` badge out of a heading, returning the badges and the cleaned text. */
function extractBadges(rawText: string): { badges: SectionBadge[]; text: string } {
  const badges: SectionBadge[] = [];

  const text = rawText.replace(BADGE, (_match, label: string, color: string) => {
    badges.push({ label: label.trim(), color: color.trim() });
    return "";
  });

  return { badges, text };
}

/**
 * Parses a markdown body into flattened heading records (heading + body text).
 * Code fences are skipped so `#` lines inside them are never treated as headings.
 * Anchors are deduped per document, matching `rehype-slug`.
 *
 * A synthetic **section 0** (`id: ""`, `level: 0`) is prepended whenever there's
 * text before the first heading — including a document with no headings at all,
 * where it carries the whole body. This keeps the section FTS a *complete* body
 * index: with the page FTS no longer storing the body, nothing (intro prose,
 * heading-less docs) would otherwise be searchable. It's filtered out of the
 * heading-level section search (`level > 0`) so it never shows as a fake heading.
 */
export function extractSectionRecords(markdown: string): SectionRecord[] {
  const slugger = new GithubSlugger();
  const lines = markdown.split(/\r?\n/);

  const records: SectionRecord[] = [];
  const bodyLines: string[][] = [];
  const leadLines: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;

    const match = inFence ? null : ATX_HEADING.exec(line);

    if (match) {
      const level = match[1].length;
      const { text } = extractBadges(match[2]);
      const title = stripInlineMarkdown(text);

      records.push({ id: slugger.slug(title), title, level, body: "" });
      bodyLines.push([]);
    } else if (records.length > 0) {
      bodyLines[bodyLines.length - 1].push(line);
    } else {
      // Text before the first heading (or the entire body when headingless).
      leadLines.push(line);
    }
  }

  const out: SectionRecord[] = records.map((record, i) => ({
    ...record,
    body: stripInlineMarkdown(bodyLines[i].join(" ").replace(/\s+/g, " ")).trim(),
  }));

  const lead = stripInlineMarkdown(leadLines.join(" ").replace(/\s+/g, " ")).trim();
  if (lead) out.unshift({ id: "", title: "", level: 0, body: lead });

  return out;
}

/**
 * Parses a markdown body into a nested heading tree (no body text) — the
 * structure consumed by a sidebar. Headings nest by depth: a heading becomes a
 * child of the nearest preceding heading with a smaller level.
 */
export function parseSections(markdown: string): SectionNode[] {
  const slugger = new GithubSlugger();
  const lines = markdown.split(/\r?\n/);

  const roots: SectionNode[] = [];
  const stack: SectionNode[] = [];
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = ATX_HEADING.exec(line);
    if (!match) continue;

    const level = match[1].length;
    const { badges, text } = extractBadges(match[2]);
    const bold = BOLD.test(text);
    const title = stripInlineMarkdown(text);

    const node: SectionNode = {
      id: slugger.slug(title),
      title,
      level,
      bold,
      badges,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();

    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);

    stack.push(node);
  }

  return roots;
}
