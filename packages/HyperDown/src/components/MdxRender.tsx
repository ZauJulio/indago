import { Suspense } from "react";
import type { ReactNode } from "react";

import { createMdxComponents } from "./MdxComponents.tsx";

import type { MdxComponent } from "../db/types.ts";
import type { ComponentMap } from "./MdxComponents.tsx";

export type { ComponentMap };

export interface MdxRenderProps {
  content: MdxComponent | null;
  /**
   * Component overrides merged on top of `defaultMdxComponents`.
   *
   * - `undefined`  → default components only
   * - `[]`         → no components (bare MDX output)
   * - `[...maps]`  → defaults merged with each map in order (last wins)
   *
   * Combine with `disableDefaults` to use only the provided maps.
   */
  components?: ComponentMap[];
  /** Skip `defaultMdxComponents` and use only the provided `components`. */
  disableDefaults?: boolean;
  fallback?: ReactNode;
  empty?: ReactNode;
}

export function MdxRender({
  content: Content,
  components,
  disableDefaults,
  fallback = null,
  empty = null,
}: MdxRenderProps): ReactNode {
  if (!Content) return empty;

  const resolved = createMdxComponents(components, { disableDefaults });

  return (
    <Suspense fallback={fallback}>
      <Content components={resolved} />
    </Suspense>
  );
}
