import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import type { SectionBadge, SectionNode } from "../frontmatter/sections.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  Sidebar — the lib's default renderer for a `SectionNode[]` heading tree.
//
//  Anyone can build their own sidebar from the exposed structure (`parseSections`
//  / `meta.sections`); this component is the batteries-included default. It:
//   - nests sections with an indent per level,
//   - collapses/expands branches with a `>`/`v` toggle,
//   - auto-expands any branch containing a **bold** heading (and the active one),
//   - in `compress` mode collapses everything else (for trees taller than the page),
//   - renders `#[label/#color]` badges as borderless pills (tinted bg, solid text),
//   - deep-links each section to its `#anchor` (overridable via `onSelect`).
//
//  Styling is overridable through `className` props; dynamic badge colours use
//  inline styles. Browser-safe (no server-only imports).
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarProps {
  /** Heading tree (e.g. `meta.sections` from a composed-indexed collection). */
  sections: SectionNode[];
  /** Currently active heading id — highlighted, and its ancestors auto-expand. */
  activeId?: string;
  /** Click handler. Defaults to navigating to `#<id>` (works with hash-scroll routers). */
  onSelect?: (id: string) => void;
  /** Collapse branches by default (unless bold/active) — for trees taller than the viewport. */
  compress?: boolean;
  /** className for the root `<nav>`. */
  className?: string;
  /** className for every section link. */
  linkClassName?: string;
  /** className added to the active section link. */
  activeLinkClassName?: string;
}

/** Pixels each heading level is indented — the "section within section" margin. */
const INDENT_PER_LEVEL = 12;

/** Appends ~15% alpha to a `#rrggbb` colour; leaves other formats untouched. */
function tint(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}26` : color;
}

/** Walks the tree, collecting the ids of every ancestor of a node matching `predicate`. */
function ancestorsOf(
  nodes: SectionNode[],
  predicate: (n: SectionNode) => boolean,
  trail: string[] = [],
  acc: Set<string> = new Set(),
): Set<string> {
  for (const node of nodes) {
    if (predicate(node)) for (const id of trail) acc.add(id);
    ancestorsOf(node.children, predicate, [...trail, node.id], acc);
  }
  return acc;
}

/** Collects ids of every node that has children. */
function branchIds(nodes: SectionNode[], acc: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.add(node.id);
      branchIds(node.children, acc);
    }
  }
  return acc;
}

/** Collapse indicator — a chevron that rotates from ▸ (closed) to ▾ (open). */
function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      className={`hd-sidebar-chevron${open ? " hd-sidebar-chevron--open" : ""}`}
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Badge({ badge }: { badge: SectionBadge }): ReactNode {
  return (
    <span
      className="hd-sidebar-badge"
      style={{ backgroundColor: tint(badge.color), color: badge.color }}
    >
      {badge.label}
    </span>
  );
}

interface NodeProps {
  node: SectionNode;
  activeId?: string;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onSelect: (id: string) => void;
  linkClassName?: string;
  activeLinkClassName?: string;
}

function SidebarNode({
  node,
  activeId,
  expanded,
  toggle,
  onSelect,
  linkClassName,
  activeLinkClassName,
}: NodeProps): ReactNode {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isActive = activeId === node.id;

  // Base left padding (matches the CSS) + one indent step per nesting level.
  const linkStyle: CSSProperties = { paddingLeft: `${8 + (node.level - 1) * INDENT_PER_LEVEL}px` };
  const cls = [
    "hd-sidebar-link",
    node.bold ? "hd-sidebar-link--bold" : "",
    isActive ? "hd-sidebar-link--active" : "",
    linkClassName ?? "",
    isActive ? (activeLinkClassName ?? "") : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="hd-sidebar-item">
      {/* The whole row is the click target: it scrolls to the section and, when
          the section has children, also toggles its collapse state. */}
      <a
        href={`#${node.id}`}
        className={cls}
        style={linkStyle}
        aria-current={isActive ? "location" : undefined}
        aria-expanded={hasChildren ? isOpen : undefined}
        onClick={(e) => {
          e.preventDefault();
          onSelect(node.id);
          if (hasChildren) toggle(node.id);
        }}
      >
        <span
          className={`hd-sidebar-toggle${hasChildren ? "" : " hd-sidebar-toggle--leaf"}`}
          aria-hidden="true"
        >
          {hasChildren ? <Chevron open={isOpen} /> : null}
        </span>
        <span className="hd-sidebar-title">{node.title}</span>
        {node.badges.map((badge) => (
          <Badge key={`${badge.label}/${badge.color}`} badge={badge} />
        ))}
      </a>

      {hasChildren && isOpen && (
        <ul className="hd-sidebar-children">
          {node.children.map((child) => (
            <SidebarNode
              key={child.id}
              node={child}
              activeId={activeId}
              expanded={expanded}
              toggle={toggle}
              onSelect={onSelect}
              linkClassName={linkClassName}
              activeLinkClassName={activeLinkClassName}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({
  sections,
  activeId,
  onSelect,
  compress = false,
  className,
  linkClassName,
  activeLinkClassName,
}: SidebarProps): ReactNode {
  // Branches that must stay open: those containing a bold heading (the spec's
  // "always expand up to a bold section"), plus the active heading's ancestors.
  const forced = useMemo(() => ancestorsOf(sections, (n) => n.bold), [sections]);
  const allBranches = useMemo(() => branchIds(sections), [sections]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(compress ? forced : allBranches),
  );

  // Re-seed when the tree or compression mode changes (e.g. SPA navigation).
  useEffect(() => {
    setExpanded(new Set(compress ? forced : allBranches));
  }, [compress, forced, allBranches]);

  // Always reveal the active section by opening its ancestors.
  useEffect(() => {
    if (!activeId) return;
    const open = ancestorsOf(sections, (n) => n.id === activeId);
    if (open.size === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of open) next.add(id);
      return next;
    });
  }, [activeId, sections]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSelect =
    onSelect ??
    ((id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
    });

  if (sections.length === 0) return null;

  return (
    <nav
      className={["hd-sidebar", className ?? ""].filter(Boolean).join(" ")}
      aria-label="Sections"
    >
      <ul className="hd-sidebar-children hd-sidebar-root">
        {sections.map((node) => (
          <SidebarNode
            key={node.id}
            node={node}
            activeId={activeId}
            expanded={expanded}
            toggle={toggle}
            onSelect={handleSelect}
            linkClassName={linkClassName}
            activeLinkClassName={activeLinkClassName}
          />
        ))}
      </ul>
    </nav>
  );
}
