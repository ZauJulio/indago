/// <reference types="vite/client" />
/// <reference types="bun-types" />

declare module "virtual:hyperdown-config" {
  import type { HyperDownConfiguration } from "@muttum/hyper-down/types";
  const config: HyperDownConfiguration;
  export default config;
}

declare module "virtual:hyperdown-frontmatter" {
  /**
   * The parsed and typed frontmatter.json configuration for the workspace.
   * This object contains all taxonomies, content types, page folders, and settings
   * defined in frontmatter.json, fully typed according to the official schemas.
   */
  import type { FrontmatterJson } from "@muttum/hyper-down/src/frontmatter/config";
  const config: FrontmatterJson;
  export default config;
}

declare module "virtual:hyperdown-collections" {
  export interface CollectionConfig {
    dbUrl: string;
    searchMode: "client" | "server";
    cacheDbName: string;
    cacheStoreName: string;
  }
  export function getCollectionConfig(name: string): Promise<CollectionConfig>;
}

declare module "virtual:hyperdown/*" {
  export const dbUrl: string;
  export const searchMode: "client" | "server";
  export const cacheDbName: string;
  export const cacheStoreName: string;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module "*?url" {
  const url: string;
  export default url;
}

interface ImportMeta {
  readonly dir: string;
  readonly main: boolean;
}
