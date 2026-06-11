// Ambient type for MDX modules compiled by @next/mdx, so the generated
// `.hyper-down/content/<type>/modules.ts` explicit imports type-check.
declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType<{ components?: Record<string, ComponentType | string> }>;
  export default MDXComponent;
}
