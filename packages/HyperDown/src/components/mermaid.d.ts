/**
 * Minimal ambient types for the OPTIONAL `mermaid` peer dependency, so the
 * package typechecks standalone — bun does not install a devDependency that is
 * also declared as an optional peer. This file is not shipped in `dist`;
 * consumers that install mermaid resolve its real types.
 */
declare module "mermaid" {
  interface MermaidRenderResult {
    svg: string;
  }

  interface MermaidApi {
    initialize(config: { startOnLoad?: boolean; theme?: string }): void;
    render(id: string, code: string): Promise<MermaidRenderResult>;
  }

  const mermaid: MermaidApi;
  export default mermaid;
}
