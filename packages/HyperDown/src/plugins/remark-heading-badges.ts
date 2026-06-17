// ─────────────────────────────────────────────────────────────────────────────
//  remarkHeadingBadges — strip `#[label/#color]` badge syntax from headings.
//
//  Tutorial headings can declare sidebar pills inline: `## Setup #[beta/#000000]`.
//  The badge belongs in the sidebar (see `parseSections`), not in the rendered
//  body, and it must not pollute the `rehype-slug` anchor. This remark plugin
//  removes the badge tokens from heading text nodes so the body heading renders
//  clean ("Setup") and its slug matches the section tree's `id`.
//
//  Dependency-free: walks the mdast tree directly rather than pulling in
//  `unist-util-visit`, keeping the plugin export light for consumers.
// ─────────────────────────────────────────────────────────────────────────────

/** `#[label/#color]` — label has no `]`/`/`; color has no `]`. */
const BADGE = /#\[[^\]/]+\/[^\]]+\]/g;

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

/** Strips badge tokens from every text node beneath a heading, then tidies whitespace. */
function cleanHeading(heading: MdastNode): void {
  for (const child of heading.children ?? []) {
    if (child.type === "text" && typeof child.value === "string") {
      child.value = child.value.replace(BADGE, "");
    } else if (child.children) {
      cleanHeading(child);
    }
  }

  // Collapse the trailing space left where a badge used to be (e.g. "Setup ").
  const children = heading.children;
  const last = children && children.length > 0 ? children[children.length - 1] : undefined;
  if (last?.type === "text" && typeof last.value === "string") {
    last.value = last.value.replace(/\s+$/, "");
  }
}

/** Remark plugin: removes `#[label/#color]` badges from ATX headings. */
export function remarkHeadingBadges() {
  return (tree: MdastNode): void => {
    const walk = (node: MdastNode): void => {
      if (node.type === "heading") cleanHeading(node);
      for (const child of node.children ?? []) walk(child);
    };

    walk(tree);
  };
}
