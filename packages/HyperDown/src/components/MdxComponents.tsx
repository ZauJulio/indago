import React, { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any -- MDX component maps require heterogeneous prop types
export type ComponentMap = Record<string, ComponentType<any> | string>;

// ─── Mermaid ────────────────────────────────────────────────────────────────

let mermaidInitialized = false;

/**
 * Renders a Mermaid diagram from a fenced code block.
 * Requires `mermaid` to be installed in the consuming app.
 */
export function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderId = useMemo(() => `mermaid-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;

    import("mermaid")
      .then(({ default: mermaid }) => {
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark" });
          mermaidInitialized = true;
        }

        return mermaid.render(renderId, code);
      })
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "mermaid render error");
      });

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  if (error) {
    return (
      <pre className="flex justify-center items-center bg-gray-900/80 rounded-xl p-4 overflow-x-auto my-4 text-sm text-red-300">
        {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <pre className="flex justify-center items-center bg-gray-900/80 rounded-xl p-4 overflow-x-auto my-4 text-sm text-gray-400">
        Rendering diagram...
      </pre>
    );
  }

  return (
    <div
      className="flex justify-center items-center my-6 overflow-x-auto rounded-xl bg-gray-950/40 p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ─── Default component map ───────────────────────────────────────────────────

/**
 * Opinionated default MDX component overrides.
 * Override individual keys via `createMdxComponents`.
 */
export const defaultMdxComponents: ComponentMap = {
  h1: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"h1">) => (
    <h1
      {...props}
      style={{ paddingBottom: "1rem" }}
      className={`text-3xl font-bold text-white mt-10 mb-4 px-4 ${className ?? ""}`}
    >
      {children}
    </h1>
  ),

  h2: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"h2">) => (
    <h2
      {...props}
      style={{ paddingBottom: "1rem" }}
      className={`text-2xl font-bold text-white mt-8 mb-4 px-4 border-b border-gray-800 ${className ?? ""}`}
    >
      {children}
    </h2>
  ),

  h3: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"h3">) => (
    <h3
      {...props}
      style={{ paddingBottom: "1rem" }}
      className={`text-xl font-semibold text-white mt-8 mb-3 px-4 ${className ?? ""}`}
    >
      {children}
    </h3>
  ),

  h4: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"h4">) => (
    <h4
      {...props}
      style={{ paddingBottom: "1rem" }}
      className={`text-lg font-semibold text-gray-200 mt-6 mb-2 px-4 ${className ?? ""}`}
    >
      {children}
    </h4>
  ),

  p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
    <div
      style={{ textAlign: "justify", textIndent: "2em" }}
      className="text-gray-300 leading-relaxed mb-4"
    >
      {children}
    </div>
  ),

  br: () => <div className="py-2" />,

  a: ({ href, children }: React.ComponentPropsWithoutRef<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        if (href?.startsWith("#")) {
          const targetId = href.slice(1);
          const element = document.getElementById(targetId);
          if (element) {
            event.preventDefault();
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            window.history.replaceState(null, "", href);
          }
        }
      }}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="text-brand-300 hover:text-brand-500 transition-colors underline decoration-brand-500/30 underline-offset-2"
    >
      {children}
    </a>
  ),

  img: ({ src, alt, style }: React.ComponentPropsWithoutRef<"img">) => (
    <>
      <br />
      <figure className="my-6 flex items-center justify-center flex-col py-8">
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          style={{
            minHeight: "30vh",
            maxHeight: "45vh",
            ...(style as React.CSSProperties),
          }}
          className="rounded-xl border border-gray-800 object-contain"
        />
        {alt && <figcaption className="text-center text-gray-500 text-sm mt-2">{alt}</figcaption>}
      </figure>
      <br />
    </>
  ),

  pre: ({ children }: React.ComponentPropsWithoutRef<"pre">) => {
    const childArray = React.Children.toArray(children as React.ReactNode);

    const shouldHide = childArray.some((child) => {
      if (!React.isValidElement(child)) return false;
      const cls = (child.props as Record<string, unknown>)?.className;
      return typeof cls === "string" && cls.includes("language-math");
    });

    const hasMermaid = childArray.some((child) => {
      if (!React.isValidElement(child)) return false;
      const cls = (child.props as Record<string, unknown>)?.className;
      return typeof cls === "string" && cls.includes("language-mermaid");
    });

    if (shouldHide) return null;
    if (hasMermaid) return <div className="my-6">{children}</div>;

    return (
      <pre className="bg-gray-900/80 rounded-xl p-4 overflow-x-auto my-4 text-sm">{children}</pre>
    );
  },

  code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<"code">) => {
    const isInline = !className;

    if (!isInline && className?.includes("language-math")) return null;

    if (!isInline && className?.includes("language-mermaid")) {
      return <MermaidBlock code={String(children).trim()} />;
    }

    if (isInline) {
      return (
        <code
          className="bg-gray-800 text-brand-300 px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code className={`${className} font-mono py-4`} {...props}>
        {children}
      </code>
    );
  },

  blockquote: ({ children }: React.ComponentPropsWithoutRef<"blockquote">) => (
    <>
      <br />
      <blockquote
        style={{ marginLeft: "1rem", marginRight: "1rem" }}
        className="border-l-4 border-brand-500/50 bg-gray-900/50 px-6 py-4 my-6 rounded-r-lg text-gray-400 italic"
      >
        {children}
      </blockquote>
      <br />
    </>
  ),

  ul: ({ children }: React.ComponentPropsWithoutRef<"ul">) => (
    <ul
      style={{ listStyleType: "disc", paddingLeft: "2.5rem" }}
      className="space-y-3 text-gray-300 my-8 mx-4 marker:text-brand-400"
    >
      {children}
    </ul>
  ),

  ol: ({ children }: React.ComponentPropsWithoutRef<"ol">) => (
    <ol
      style={{ listStyleType: "decimal", paddingLeft: "2.5rem" }}
      className="space-y-3 text-gray-300 my-8 mx-4 marker:text-brand-400"
    >
      {children}
    </ol>
  ),

  li: ({ children, ...props }: React.ComponentPropsWithoutRef<"li">) => {
    const hasNestedList = React.Children.toArray(children as React.ReactNode).some(
      (child) => React.isValidElement(child) && (child.type === "ul" || child.type === "ol"),
    );
    return (
      <li
        className={
          hasNestedList
            ? "text-gray-300 leading-relaxed"
            : "text-gray-300 leading-relaxed list-item"
        }
        {...props}
      >
        {children}
      </li>
    );
  },

  table: ({ children }: React.ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto my-6">
      <br />
      <table className="w-full text-sm border-collapse border border-gray-800 rounded-lg">
        {children}
      </table>
      <br />
    </div>
  ),

  thead: ({ children }: React.ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-gray-900">{children}</thead>
  ),

  th: ({ children }: React.ComponentPropsWithoutRef<"th">) => (
    <th className="text-left px-4 py-2 text-gray-300 font-semibold border border-gray-800">
      {children}
    </th>
  ),

  td: ({ children }: React.ComponentPropsWithoutRef<"td">) => (
    <td className="px-4 py-2 text-gray-400 border border-gray-800">{children}</td>
  ),

  hr: () => (
    <div className="my-8">
      <hr className="border-gray-800" />
    </div>
  ),

  strong: ({ children }: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),

  em: ({ children }: React.ComponentPropsWithoutRef<"em">) => (
    <em className="text-gray-300 italic">{children}</em>
  ),

  iframe: ({ title, style, ...props }: React.ComponentPropsWithoutRef<"iframe">) => (
    <div className="my-6 rounded-xl overflow-hidden border border-gray-800">
      <iframe
        title={title ?? "Embedded content"}
        {...props}
        className="w-full"
        style={{ minHeight: "400px", ...(style as React.CSSProperties) }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
      />
    </div>
  ),
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Resolve the final component map from the provided overrides.
 *
 * - `undefined`  → default components only
 * - `[]`         → no components (empty map)
 * - `[...maps]`  → default components merged with each override in order (last wins)
 *
 * Pass `{ disableDefaults: true }` to skip the defaults entirely and use only
 * the provided maps.
 */
export function createMdxComponents(
  components?: ComponentMap[],
  options?: { disableDefaults?: boolean },
): ComponentMap {
  if (components !== undefined && components.length === 0) return {};

  const base: ComponentMap = options?.disableDefaults ? {} : { ...defaultMdxComponents };

  if (!components) return base;

  return components.reduce<ComponentMap>((acc, map) => ({ ...acc, ...map }), base);
}
