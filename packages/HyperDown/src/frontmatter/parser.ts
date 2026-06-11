import { parse as yamlParse } from "yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

export class FrontmatterParser {
  private static readonly FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

  public parse(raw: string): ParsedFrontmatter {
    const match = raw.match(FrontmatterParser.FRONTMATTER_RE);
    if (!match) {
      return { data: {}, content: raw };
    }

    const [_, yamlBlock, content] = match;
    let data: Record<string, unknown> = {};

    try {
      const parsed = yamlParse(yamlBlock);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // Return empty data on invalid YAML
    }

    return { data, content };
  }
}

export const parseFrontmatter = (raw: string): ParsedFrontmatter => {
  return new FrontmatterParser().parse(raw);
};
