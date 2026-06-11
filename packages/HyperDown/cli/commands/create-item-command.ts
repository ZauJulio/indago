import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import * as p from "@clack/prompts";

import { log } from "../../src/utils/logger.server.ts";

interface HyperDownConfig {
  database?: {
    contentDir?: string;
    frontmatterJsonPath?: string;
  };
}

export class CreateItemCommand {
  public async run(options: Record<string, string>): Promise<void> {
    const workspaceDir = this.findWorkspaceDir(options.path);
    if (!workspaceDir) {
      log.error("❌ workspace not found (missing frontmatter.json)");
      process.exit(1);
    }

    const configPath = this.resolveConfigPath(workspaceDir, options.path);
    const configDir = configPath ? dirname(configPath) : workspaceDir;
    const hdConfig = configPath ? this.loadHyperDownConfig(configPath) : null;
    const contentDir = hdConfig?.database?.contentDir ?? "src/content";

    // `frontmatterJsonPath` is relative to the config file's directory — matching
    // the convention used by the writer, codegen, plugin and validator.
    let fmConfigPath = join(workspaceDir, "frontmatter.json");
    if (hdConfig?.database?.frontmatterJsonPath) {
      fmConfigPath = resolve(configDir, hdConfig.database.frontmatterJsonPath);
    }

    const fmConfig = JSON.parse(readFileSync(fmConfigPath, "utf-8"));

    type RawField = {
      name: string;
      title: string;
      type: string;
      choices?: string[];
      required?: boolean;
    };
    type RawContentType = { name: string; fields?: RawField[] };

    const contentTypes = (fmConfig["frontMatter.taxonomy.contentTypes"] || []) as RawContentType[];
    if (contentTypes.length === 0) {
      log.error("❌ No content types found in frontmatter.json.");
      process.exit(1);
    }

    const isInteractive = !options.type || !options.slug || !options.lang;

    let typeName = options.type;
    let slug = options.slug;
    let lang = options.lang || "en";

    const fieldValues: Record<string, unknown> = {};

    if (isInteractive) {
      p.intro("🚀 HyperDown Content Item Creator");

      const typeChoice = await p.select({
        message: "Select the content type:",
        options: contentTypes.map((ct) => ({ value: ct.name, label: ct.name })),
      });
      if (p.isCancel(typeChoice)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }
      typeName = String(typeChoice);

      const ctDef = contentTypes.find((ct) => ct.name === typeName);

      const slugInput = await p.text({
        message: "Enter the slug (filename):",
        validate: (val) => (!val ? "Required" : undefined),
      });
      if (p.isCancel(slugInput)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }
      slug = String(slugInput);

      const langInput = await p.text({
        message: "Enter language (e.g. en, pt-BR):",
        initialValue: "en",
      });
      if (p.isCancel(langInput)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }
      lang = String(langInput);

      for (const field of ctDef?.fields ?? []) {
        if (field.name === "slug" || field.name === "lang") continue;

        if (field.type === "string" || field.type === "datetime") {
          const val = await p.text({ message: `${field.title} (${field.name}):` });
          if (p.isCancel(val)) process.exit(0);

          fieldValues[field.name] = val;
        } else if (field.type === "boolean" || field.type === "draft") {
          const val = await p.confirm({ message: `${field.title} (${field.name})?` });
          if (p.isCancel(val)) process.exit(0);

          fieldValues[field.name] = val;
        } else if (field.type === "choice") {
          const val = await p.select({
            message: `${field.title} (${field.name}):`,
            options: (field.choices || []).map((c: string) => ({ value: c, label: c })),
          });

          if (p.isCancel(val)) process.exit(0);
          fieldValues[field.name] = val;
        } else {
          const val = await p.text({
            message: `${field.title} (${field.name}) [JSON or comma separated]:`,
          });

          if (p.isCancel(val)) process.exit(0);

          if (field.type === "tags" || field.type === "categories") {
            fieldValues[field.name] = String(val)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          } else {
            fieldValues[field.name] = val;
          }
        }
      }
    } else {
      const ctDef = contentTypes.find((ct) => ct.name === typeName);

      if (!ctDef) {
        log.error(`❌ Content type '${typeName}' not found.`);
        process.exit(1);
      }

      for (const field of ctDef.fields ?? []) {
        if (field.name === "slug" || field.name === "lang") continue;
        fieldValues[field.name] =
          field.type === "boolean" ? false : field.type === "tags" ? [] : "";
      }
    }

    const ctDef = contentTypes.find((ct) => ct.name === typeName);
    type RawPageFolder = { path: string; contentTypes?: string[] };

    const pageFolders = (fmConfig["frontMatter.content.pageFolders"] || []) as RawPageFolder[];
    const targetFolder = pageFolders.find((pf) => (pf.contentTypes ?? []).includes(typeName));

    let destFolder = join(workspaceDir, contentDir, typeName, lang);
    if (targetFolder) {
      const resolvedPath = targetFolder.path.replace("[[workspace]]", workspaceDir);
      destFolder = join(resolvedPath, lang);
    }

    if (!existsSync(destFolder)) mkdirSync(destFolder, { recursive: true });

    const filePath = join(destFolder, `${slug}.mdx`);

    let yaml = "---\n";
    if (isInteractive) {
      for (const [k, v] of Object.entries(fieldValues)) {
        if (Array.isArray(v)) {
          yaml += `${k}:\n`;
          v.forEach((item) => (yaml += `  - ${item}\n`));
        } else if (typeof v === "boolean") {
          yaml += `${k}: ${v}\n`;
        } else {
          yaml += `${k}: "${v}"\n`;
        }
      }
    } else {
      for (const field of ctDef?.fields ?? []) {
        if (field.type === "string") yaml += `${field.name}: ""\n`;
        else if (field.type === "boolean" || field.type === "draft")
          yaml += `${field.name}: false\n`;
        else if (field.type === "tags" || field.type === "categories")
          yaml += `${field.name}: []\n`;
        else yaml += `${field.name}: ""\n`;
      }
    }

    yaml += "---\n\nWrite your content here...\n";

    writeFileSync(filePath, yaml);

    if (isInteractive) {
      p.outro(`✨ Created ${filePath}`);
    } else {
      log.info(`✅ Created ${filePath}`);
    }
  }

  private findWorkspaceDir(configPath?: string): string | null {
    if (configPath) {
      const resolved = resolve(process.cwd(), configPath);
      const dir = resolved.endsWith(".json") ? resolve(resolved, "..") : resolved;
      if (existsSync(join(dir, "frontmatter.json"))) return dir;
    }

    let workspaceDir = process.cwd();
    while (workspaceDir !== "/" && !existsSync(join(workspaceDir, "frontmatter.json"))) {
      workspaceDir = resolve(workspaceDir, "..");
    }

    return existsSync(join(workspaceDir, "frontmatter.json")) ? workspaceDir : null;
  }

  /** Resolves the absolute path to the hyperdown.config.json that applies. */
  private resolveConfigPath(workspaceDir: string, configPath?: string): string | null {
    const candidates = [
      configPath ? resolve(process.cwd(), configPath) : null,
      join(workspaceDir, "hyperdown.config.json"),
      join(process.cwd(), "hyperdown.config.json"),
    ];

    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) return candidate;
    }

    return null;
  }

  private loadHyperDownConfig(configPath: string): HyperDownConfig | null {
    try {
      return JSON.parse(readFileSync(configPath, "utf-8")) as HyperDownConfig;
    } catch {
      return null; // malformed config
    }
  }
}
