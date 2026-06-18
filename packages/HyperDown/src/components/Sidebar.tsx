import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { SectionBadge } from "../frontmatter/sections.ts";

// ─────────────────────────────────────────────────────────────────────────────
//  Sidebar — a generic, batteries-included renderer for any nested tree.
//
//  It was born as the renderer for a `SectionNode[]` heading tree, but its only
//  requirement is a {@link TreeNode}: `{ id, title, children }` (plus optional
//  `bold`/`badges`). `SectionNode` satisfies that shape, so `meta.sections` still
//  drops straight in — but so does any other hierarchy (file trees, menus, …).
//
//  Vercel-docs styling: a vertical guide line runs down each nested level and the
//  collapse/expand caret sits in a square box on the **right** of every branch
//  row. It:
//   - nests children behind a left guide line (the "section within section" rail),
//   - collapses/expands branches via the right-aligned caret box (▾ open ▸ closed),
//   - renders **branch** rows (anything with children) in bold,
//   - auto-expands any branch containing a `bold` node (and the active one),
//   - in `compress` mode collapses everything else (for trees taller than the page),
//   - renders `#[label/#color]` badges as borderless pills (tinted bg, solid text),
//   - deep-links each row to its `#anchor` (overridable via `onSelect`).
//
//  Styling is overridable through `className` props; dynamic badge colours use
//  inline styles. Browser-safe (no server-only imports).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The minimal shape the {@link Sidebar} renders. `SectionNode` is assignable to
 * it, but any `{ id, title, children }` hierarchy works — that's what makes the
 * component reusable for anything, not just heading trees.
 */
export interface TreeNode {
  /** Stable id — used as the anchor target and React key. */
  id: string;
  /** Display label. */
  title: string;
  /** Nested children (empty for a leaf). */
  children: TreeNode[];
  /** Render this row's title in bold (independent of being a branch). */
  bold?: boolean;
  /** Optional pills shown after the title. */
  badges?: SectionBadge[];
}

export interface SidebarProps {
  /** The tree to render. Prefer this; `sections` is kept as a back-compat alias. */
  items?: TreeNode[];
  /** @deprecated Use `items`. Heading tree (e.g. `meta.sections`). */
  sections?: TreeNode[];
  /** Currently active node id — highlighted, and its ancestors auto-expand. */
  activeId?: string;
  /** Click handler. Defaults to navigating to `#<id>` (works with hash-scroll routers). */
  onSelect?: (id: string) => void;
  /** Collapse branches by default (unless bold/active) — for trees taller than the viewport. */
  compress?: boolean;
  /** className for the root `<nav>`. */
  className?: string;
  /** className for every row link. */
  linkClassName?: string;
  /** className added to the active row link. */
  activeLinkClassName?: string;
}

/** Appends ~15% alpha to a `#rrggbb` colour; leaves other formats untouched. */
function tint(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}26` : color;
}

/** Walks the tree, collecting the ids of every ancestor of a node matching `predicate`. */
function ancestorsOf(
  nodes: TreeNode[],
  predicate: (n: TreeNode) => boolean,
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
function branchIds(nodes: TreeNode[], acc: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.add(node.id);
      branchIds(node.children, acc);
    }
  }
  return acc;
}

/** Collapse caret — a filled triangle that rotates from ▸ (closed) to ▾ (open). */
function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      className={`hd-sidebar-chevron${open ? " hd-sidebar-chevron--open" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.1808 15.8297L6.54199 9.20285C5.89247 8.27496 6.55629 7 7.68892 7L16.3111 7C17.4437 7 18.1075 8.27496 17.458 9.20285L12.8192 15.8297C12.4211 16.3984 11.5789 16.3984 11.1808 15.8297Z" />
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
  node: TreeNode;
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
  const badges = node.badges ?? [];

  const cls = [
    "hd-sidebar-link",
    // Branch rows (anything expandable) read as headings — always bold; leaf rows
    // only bold when the node itself asks for it.
    hasChildren || node.bold ? "hd-sidebar-link--bold" : "",
    isActive ? "hd-sidebar-link--active" : "",
    linkClassName ?? "",
    isActive ? (activeLinkClassName ?? "") : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="hd-sidebar-item">
      {/* Two distinct targets in one row: the link navigates to the node's anchor;
          the caret button (branches only) collapses/expands. They're siblings — not
          nested — so a caret click never also navigates. */}
      <div className={cls}>
        <a
          href={`#${node.id}`}
          className="hd-sidebar-link-text"
          aria-current={isActive ? "location" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onSelect(node.id);
          }}
        >
          <span className="hd-sidebar-title">{node.title}</span>
          {badges.map((badge) => (
            <Badge key={`${badge.label}/${badge.color}`} badge={badge} />
          ))}
        </a>
        {hasChildren && (
          <button
            type="button"
            className="hd-sidebar-toggle"
            aria-label={isOpen ? "Collapse section" : "Expand section"}
            aria-expanded={isOpen}
            onClick={() => toggle(node.id)}
          >
            <Chevron open={isOpen} />
          </button>
        )}
      </div>

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
  items,
  sections,
  activeId,
  onSelect,
  compress = false,
  className,
  linkClassName,
  activeLinkClassName,
}: SidebarProps): ReactNode {
  // `items` is the canonical prop; `sections` is the back-compat alias.
  const nodes = useMemo(() => items ?? sections ?? [], [items, sections]);

  // Branches that must stay open: those containing a bold node (the spec's
  // "always expand up to a bold section"), plus the active node's ancestors.
  const forced = useMemo(() => ancestorsOf(nodes, (n) => Boolean(n.bold)), [nodes]);
  const allBranches = useMemo(() => branchIds(nodes), [nodes]);

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
    const open = ancestorsOf(nodes, (n) => n.id === activeId);
    if (open.size === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of open) next.add(id);
      return next;
    });
  }, [activeId, nodes]);

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

  if (nodes.length === 0) return null;

  return (
    <nav
      className={["hd-sidebar", className ?? ""].filter(Boolean).join(" ")}
      aria-label="Sections"
    >
      <ul className="hd-sidebar-children hd-sidebar-root">
        {nodes.map((node) => (
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
