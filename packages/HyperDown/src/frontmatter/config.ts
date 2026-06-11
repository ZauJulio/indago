import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import type { FrontMatterTeamSettings } from "./schema-types.ts";

// ─── Stable type aliases derived from the auto-generated flat interface ───────
// These are the types used throughout the codebase; they are derived from the
// generated FrontMatterTeamSettings so consumers don't need to reference the
// auto-generated names directly.

/** The top-level frontmatter configuration object. */
export type FrontmatterConfig = FrontMatterTeamSettings;

/** A single page-folder entry from `"frontMatter.content.pageFolders"`. */
export type FrontMatterPageFolder = NonNullable<
  FrontMatterTeamSettings["frontMatter.content.pageFolders"]
>[number];

/** A single content-type entry from `"frontMatter.taxonomy.contentTypes"`. */
export type FrontMatterContentType = NonNullable<
  NonNullable<FrontMatterTeamSettings["frontMatter.taxonomy.contentTypes"]>[number]
>;

export interface FrontmatterField {
  title: string;
  name: string;
  type: string;
  default?: string;
  isPublishDate?: boolean;
  required?: boolean;
  choices?: string[];
  [key: string]: unknown;
}

export interface TypedFrontMatterContentType extends Omit<FrontMatterContentType, "fields"> {
  name: string;
  fields: FrontmatterField[];
}

export interface FrontmatterJson extends FrontmatterConfig {
  "frontMatter.taxonomy.contentTypes"?: TypedFrontMatterContentType[];
  "frontMatter.content.pageFolders"?: FrontMatterPageFolder[];
}

export class FrontmatterConfigManager {
  private configPath: string;
  private configCache: FrontmatterJson | null = null;

  constructor(configPath: string) {
    this.configPath = resolve(configPath);
  }

  public loadConfig(): FrontmatterJson {
    if (this.configCache) {
      return this.configCache;
    }

    if (!existsSync(this.configPath)) {
      throw new Error(`Frontmatter config not found at ${this.configPath}`);
    }

    const raw = readFileSync(this.configPath, "utf-8");
    this.configCache = JSON.parse(raw) as FrontmatterJson;
    return this.configCache;
  }

  public getContentTypes(): TypedFrontMatterContentType[] {
    const config = this.loadConfig();
    return config["frontMatter.taxonomy.contentTypes"] || [];
  }

  public getPageFolders(): FrontMatterPageFolder[] {
    const config = this.loadConfig();
    return config["frontMatter.content.pageFolders"] || [];
  }

  public getContentTypeByName(name: string): TypedFrontMatterContentType | undefined {
    return this.getContentTypes().find((ct) => ct.name === name);
  }
}
