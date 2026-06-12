import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

import { GENERATED_BANNER } from "../plugins/templates.ts";
import { scriptLog } from "../utils/logger.server.ts";

import type {
  FrontmatterJson,
  TypedFrontMatterContentType,
  FrontMatterPageFolder,
} from "./config.ts";

export class HyperDownCodegen {
  /** App directory — where `hyperdown.config.json` lives. Base for `.hyper-down`. */
  private appDir: string;
  private fmConfigPath: string;
  /** `database.contentDir` from hyperdown.config.json (relative to appDir). */
  private contentDir: string;
  private fmConfig: FrontmatterJson;
  private contentTypes: TypedFrontMatterContentType[];
  private pageFolders: FrontMatterPageFolder[];

  constructor(customRootDir?: string) {
    this.appDir = customRootDir || process.cwd();
    this.contentDir = "./src/content";
    this.fmConfigPath = this.resolveFrontmatterPath();
    this.fmConfig = JSON.parse(readFileSync(this.fmConfigPath, "utf-8")) as FrontmatterJson;
    this.contentTypes = this.fmConfig["frontMatter.taxonomy.contentTypes"] ?? [];
    this.pageFolders = this.fmConfig["frontMatter.content.pageFolders"] ?? [];
  }

  private resolveFrontmatterPath(): string {
    const hdConfigPath = resolve(this.appDir, "hyperdown.config.json");
    if (!existsSync(hdConfigPath)) {
      // Throw (not process.exit) so embedders like the Vite plugin can recover.
      throw new Error(`hyperdown.config.json not found in ${this.appDir}`);
    }
    const hdConfig = JSON.parse(readFileSync(hdConfigPath, "utf-8"));
    this.contentDir = hdConfig.database?.contentDir || "./src/content";

    const fmPathRelative = hdConfig.database?.frontmatterJsonPath || "frontmatter.json";
    const fmConfigPath = resolve(this.appDir, fmPathRelative);

    if (!existsSync(fmConfigPath)) {
      throw new Error(`frontmatter.json not found at ${fmConfigPath}`);
    }

    return fmConfigPath;
  }

  /** Writes `content` to `path` only when it differs — avoids touching mtimes on
   *  no-op rebuilds so editors (TS Server) don't see spurious change events. */
  private writeIfChanged(path: string, content: string): void {
    if (existsSync(path) && readFileSync(path, "utf-8") === content) return;

    writeFileSync(path, content);
    scriptLog.info(`Generated ${path}`);
  }

  private readonly banner = GENERATED_BANNER;

  private generateTypesCode(typeName: string, ct: TypedFrontMatterContentType): string {
    let tsCode = this.banner;
    tsCode += `import type { ContentMeta } from "@muttum/hyper-down/types";\n\n`;
    tsCode += `declare module "@muttum/hyper-down" {\n`;

    const interfaceName = typeName.charAt(0).toUpperCase() + typeName.slice(1) + "Meta";
    tsCode += `  export interface ${interfaceName} extends ContentMeta {\n`;

    for (const field of ct.fields) {
      let tsType = "string";

      if (field.type === "tags" || field.type === "categories") {
        tsType = "string[]";
      } else if (field.type === "draft") {
        tsType = "boolean";
      } else if (field.type === "choice" && field.choices) {
        tsType = field.choices.map((c: string) => `"${c}"`).join(" | ");
      }

      const isRequired =
        field.required === true || field.isPublishDate === true || field.name === "title";

      const optFlag = isRequired ? "" : "?";
      tsCode += `    ${field.name}${optFlag}: ${tsType};\n`;
    }

    tsCode += `  }\n}\n`;
    return tsCode;
  }

  /** The collection's server-only `ContentRepository`, exported as a lazy proxy
   *  (`createLazyRepository`). The `new` is deferred past module-eval to dodge a
   *  Rolldown chunk init-order trap — see `createLazyRepository`. */
  private generateBuilderCode(tableName: string): string {
    const interfaceName = tableName.charAt(0).toUpperCase() + tableName.slice(1) + "Meta";

    let code = this.banner;
    code += `import { createLazyRepository } from "@muttum/hyper-down/server";\n\n`;
    code += `import type { ${interfaceName} } from "@muttum/hyper-down";\n\n`;
    code += `// Server-only DAO for the \`${tableName}\` collection — imported by \`+data.ts\`\n`;
    code += `// loaders (SSR-only), never by browser code. Lazily instantiated.\n`;
    code += `export const ${tableName}Repository = createLazyRepository<${interfaceName}>({\n`;
    code += `  contentName: "${tableName}",\n`;
    code += `});\n`;
    return code;
  }

  /** The `import.meta.glob` map of a content type's MDX bodies (static literal —
   *  Vite can't resolve dynamic templates). `eager: true` is load-bearing for SSG:
   *  it inlines the body into prerendered HTML; a lazy glob flushes the Suspense
   *  skeleton instead. Trade-off: every body ships in the detail page's client JS
   *  (fine for small sets; prefer SSR for large collections). */
  private generateModulesCode(contentName: string, contentRel: string): string {
    let code = this.banner;

    code += `import type { ContentModuleMap } from "@muttum/hyper-down/types";\n\n`;
    code += `export default import.meta.glob("/${contentRel}/${contentName}/**/*.mdx", { eager: true }) as ContentModuleMap;\n`;

    return code;
  }

  /** Barrel exporting a single `contentModules` map keyed by content-type name,
   *  e.g. `{ article: articleModules, recipe: recipeModules }`. Consumers pass a
   *  single entry to `createContentResolver(contentModules["article"])`. */
  private generateDefaultBarrel(entries: { name: string; contentRel: string }[]): string {
    let code = this.banner;

    for (const { name, contentRel } of entries) {
      code += `import ${name}Modules from "./${contentRel}/${name}/modules";\n`;
    }

    code += `\nexport const contentModules = {\n`;

    for (const { name } of entries) {
      code += `  ${name}: ${name}Modules,\n`;
    }

    code += `};\n\n`;
    code += `/** Union of the content-type names, e.g. \`"article" | "recipe"\`. */\n`;
    code += `export type ContentType = keyof typeof contentModules;\n`;

    return code;
  }

  public generate(): void {
    // contentDir like "./src/content" → "src/content" (relative to appDir / Vite root).
    const contentRel = this.contentDir.replace(/^\.?\/+/, "");
    const barrelEntries: { name: string; contentRel: string }[] = [];

    for (const folder of this.pageFolders) {
      const contentName = folder.contentTypes?.[0] ?? folder.title.toLowerCase();
      const absPath = join(this.appDir, ".hyper-down", contentRel, contentName);

      mkdirSync(absPath, { recursive: true });

      for (const typeName of folder.contentTypes ?? []) {
        const ct = this.contentTypes.find((c) => c.name === typeName);
        if (!ct) continue;

        // Ambient `<Type>Meta` interface.
        this.writeIfChanged(join(absPath, "types.ts"), this.generateTypesCode(typeName, ct));

        // Server-only repository instance.
        const tableName = folder.contentTypes?.[0] || folder.title.toLowerCase();
        this.writeIfChanged(join(absPath, "builder.ts"), this.generateBuilderCode(tableName));
      }

      // Runtime MDX module map for this content type.
      this.writeIfChanged(
        join(absPath, "modules.ts"),
        this.generateModulesCode(contentName, contentRel),
      );

      barrelEntries.push({ name: contentName, contentRel });
    }

    // `.hyper-down/default.ts` barrel — imported by the consuming app as `@hyper-down/default`.
    if (barrelEntries.length > 0) {
      this.writeIfChanged(
        join(this.appDir, ".hyper-down", "default.ts"),
        this.generateDefaultBarrel(barrelEntries),
      );
    }
  }
}

if (import.meta.main) {
  try {
    new HyperDownCodegen().generate();
  } catch (err) {
    scriptLog.fatal(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
