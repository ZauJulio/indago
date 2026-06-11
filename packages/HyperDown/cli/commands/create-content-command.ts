import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

import * as p from "@clack/prompts";

import { scriptLog } from "../../src/utils/logger.server.ts";
import { BaseCommand } from "./base-command.ts";

interface CreateContentOptions {
  name?: string;
  folder?: string;
  fields?: string;
  path?: string;
  noInteractive?: boolean;
}

interface HyperDownConfig {
  database?: {
    contentDir?: string;
    frontmatterJsonPath?: string;
    outputPath?: string;
  };
}

export class CreateContentCommand extends BaseCommand {
  public async run(options: CreateContentOptions): Promise<void> {
    const isInteractive = !options.noInteractive && !options.name;

    let contentName = options.name;
    let folderTitle = options.folder;
    let fieldsStr = options.fields;
    let configPath = options.path;

    if (isInteractive) {
      const answers = await this.promptInteractive(configPath);
      contentName = answers.contentName;
      folderTitle = answers.folderTitle;
      fieldsStr = answers.fieldsStr;
      configPath = answers.configPath;
    }

    if (!contentName || !folderTitle || !fieldsStr) {
      scriptLog.error("Missing required arguments. Use --help");
      process.exit(1);
    }

    const s = p.spinner();
    s.start("Updating workspace config...");

    const workspaceDir = this.findWorkspaceDir(configPath);
    if (!workspaceDir) {
      s.stop("Failed");
      scriptLog.error("Could not find frontmatter.json in workspace.");
      process.exit(1);
    }

    const fmPath = join(workspaceDir, "frontmatter.json");
    const fmConfig = JSON.parse(readFileSync(fmPath, "utf-8"));

    const hdConfig = this.loadHyperDownConfig(workspaceDir, configPath);
    const contentDir = hdConfig?.database?.contentDir ?? "src/content";

    const fieldDefs = this.parseFields(fieldsStr);

    this.updateContentTypes(fmConfig, contentName, fieldDefs);
    this.updatePageFolders(fmConfig, contentName, folderTitle, contentDir);

    writeFileSync(fmPath, JSON.stringify(fmConfig, null, 2) + "\n");

    const templateYaml = this.generateTemplateYaml(fieldDefs);
    this.writeTemplateFiles(workspaceDir, contentName, contentDir, templateYaml);

    s.message("Running codegen scripts...");
    this.runCodegenScripts(workspaceDir, configPath, s);

    if (isInteractive) {
      const examplePath = join(contentDir, `${contentName}s`, "en", "example.mdx");
      p.outro(`✨ Content type '${contentName}' created successfully! Check ${examplePath}`);
    }
  }

  private async promptInteractive(defaultConfigPath?: string): Promise<{
    contentName: string;
    folderTitle: string;
    fieldsStr: string;
    configPath: string;
  }> {
    p.intro("🚀 HyperDown Content Type Bootstrapper");

    const configRes = await p.text({
      message: "Path to hyperdown.config.json:",
      placeholder: "./hyperdown.config.json",
      initialValue: defaultConfigPath ?? "./hyperdown.config.json",
    });

    if (p.isCancel(configRes)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const typeRes = await p.text({
      message: "What is the singular name of the content type? (e.g., article, product)",
      placeholder: "product",
      validate: (value) => {
        if (!value) return "Name is required";
        if (!/^[a-z0-9_-]+$/.test(value)) return "Only lowercase, numbers, -, _ allowed";
        return undefined;
      },
    });

    if (p.isCancel(typeRes)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const folderRes = await p.text({
      message: "What is the plural title for the folder? (e.g., Products)",
      placeholder: "Products",
      validate: (value) => {
        if (!value) return "Folder title is required";
        return undefined;
      },
    });

    if (p.isCancel(folderRes)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    let fieldsStr = "title:string:req";
    let addingFields = true;

    while (addingFields) {
      const addMore = await p.confirm({
        message: "Do you want to add another field? (title is already added)",
        initialValue: false,
      });

      if (p.isCancel(addMore)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      if (!addMore) {
        addingFields = false;
        break;
      }

      const fieldName = await p.text({
        message: "Field name (e.g., price, draft, category):",
        validate: (val) => (!val ? "Required" : undefined),
      });

      if (p.isCancel(fieldName)) process.exit(0);

      const fieldType = await p.select({
        message: "Field type:",
        options: [
          { value: "string", label: "String" },
          { value: "number", label: "Number" },
          { value: "boolean", label: "Boolean" },
          { value: "datetime", label: "Datetime" },
          { value: "draft", label: "Draft" },
          { value: "tags", label: "Tags" },
          { value: "categories", label: "Categories" },
          { value: "image", label: "Image" },
          { value: "choice", label: "Choice (Enum)" },
        ],
      });

      if (p.isCancel(fieldType)) process.exit(0);

      let choiceValues = "";
      if (fieldType === "choice") {
        const choices = await p.text({
          message: "Pipe separated choices (e.g. admin|user):",
        });
        if (p.isCancel(choices)) process.exit(0);
        choiceValues = `[${String(choices)}]`;
      }

      const isRequired = await p.confirm({
        message: "Is this field required?",
        initialValue: false,
      });

      if (p.isCancel(isRequired)) process.exit(0);

      fieldsStr += `,${String(fieldName)}:${String(fieldType)}${choiceValues}:${isRequired ? "req" : "opt"}`;
    }

    return {
      contentName: String(typeRes),
      folderTitle: String(folderRes),
      fieldsStr,
      configPath: String(configRes),
    };
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

  private loadHyperDownConfig(workspaceDir: string, configPath?: string): HyperDownConfig | null {
    const candidates = [
      configPath ? resolve(process.cwd(), configPath) : null,
      join(workspaceDir, "hyperdown.config.json"),
      join(process.cwd(), "hyperdown.config.json"),
    ];

    for (const p of candidates) {
      if (p && existsSync(p)) {
        try {
          return JSON.parse(readFileSync(p, "utf-8")) as HyperDownConfig;
        } catch {
          // skip malformed configs
        }
      }
    }
    return null;
  }

  private parseFields(fieldsStr: string): Record<string, unknown>[] {
    const fieldDefs: Record<string, unknown>[] = [];
    for (const f of fieldsStr.split(",")) {
      const match = f.match(/^([a-zA-Z0-9_-]+):([a-z]+)(\[[^\]]+\])?:(req|opt)$/);
      if (!match) continue;
      const [, name, type, choicesStr, req] = match;
      const field: Record<string, unknown> = {
        title: name.charAt(0).toUpperCase() + name.slice(1),
        name,
        type,
      };
      if (req === "req") field.required = true;
      if (type === "choice" && choicesStr) {
        field.choices = choicesStr
          .slice(1, -1)
          .split("|")
          .map((c: string) => c.trim());
      }
      fieldDefs.push(field);
    }
    return fieldDefs;
  }

  private updateContentTypes(
    fmConfig: Record<string, unknown>,
    contentName: string,
    fieldDefs: Record<string, unknown>[],
  ): void {
    fmConfig["frontMatter.taxonomy.contentTypes"] =
      (fmConfig["frontMatter.taxonomy.contentTypes"] as unknown[]) || [];
    const existsCT = (
      fmConfig["frontMatter.taxonomy.contentTypes"] as Record<string, unknown>[]
    ).find((ct: Record<string, unknown>) => ct.name === contentName);
    if (existsCT) {
      existsCT.fields = fieldDefs;
    } else {
      (fmConfig["frontMatter.taxonomy.contentTypes"] as Record<string, unknown>[]).push({
        name: contentName,
        pageBundle: false,
        previewPath: null,
        fields: fieldDefs,
      });
    }
  }

  private updatePageFolders(
    fmConfig: Record<string, unknown>,
    contentName: string,
    folderTitle: string,
    contentDir: string,
  ): void {
    const folderPath = `[[workspace]]/${contentDir}/${contentName}s`;
    fmConfig["frontMatter.content.pageFolders"] =
      (fmConfig["frontMatter.content.pageFolders"] as unknown[]) || [];
    const existsPF = (
      fmConfig["frontMatter.content.pageFolders"] as Record<string, unknown>[]
    ).find((pf: Record<string, unknown>) =>
      (pf.contentTypes as string[] | undefined)?.includes(contentName),
    );
    if (!existsPF) {
      (fmConfig["frontMatter.content.pageFolders"] as Record<string, unknown>[]).push({
        title: folderTitle,
        path: folderPath,
        filePrefix: "",
        contentTypes: [contentName],
        defaultLocale: "en",
        locales: [
          { title: "English", locale: "en", path: "en" },
          { title: "Português (Brasil)", locale: "pt-BR", path: "pt-BR" },
        ],
      });
    }
  }

  private generateTemplateYaml(fieldDefs: Record<string, unknown>[]): string {
    let templateYaml = "---\n";
    for (const f of fieldDefs) {
      if (f.type === "string") templateYaml += `${f.name}: ""\n`;
      else if (f.type === "number") templateYaml += `${f.name}: 0\n`;
      else if (f.type === "boolean" || f.type === "draft") templateYaml += `${f.name}: false\n`;
      else if (f.type === "tags" || f.type === "categories") templateYaml += `${f.name}: []\n`;
      else if (f.type === "datetime") templateYaml += `${f.name}: 2026-01-01T12:00:00Z\n`;
      else if (f.type === "choice") templateYaml += `${f.name}: "${f.choices?.[0] || ""}"\n`;
      else templateYaml += `${f.name}: null\n`;
    }
    templateYaml += "---\n\nWrite your content here...";
    return templateYaml;
  }

  private writeTemplateFiles(
    workspaceDir: string,
    contentName: string,
    contentDir: string,
    templateYaml: string,
  ): void {
    const templatesDir = join(workspaceDir, ".frontmatter", "templates");
    if (!existsSync(templatesDir)) mkdirSync(templatesDir, { recursive: true });
    writeFileSync(join(templatesDir, `${contentName}.md`), templateYaml);

    const destFolder = join(workspaceDir, contentDir, `${contentName}s`, "en");
    if (!existsSync(destFolder)) mkdirSync(destFolder, { recursive: true });

    const examplePath = join(destFolder, "example.mdx");
    if (!existsSync(examplePath)) {
      writeFileSync(examplePath, templateYaml);
    }
  }

  private runCodegenScripts(
    workspaceDir: string,
    configPath: string | undefined,
    spinner: ReturnType<typeof p.spinner>,
  ): void {
    try {
      execSync("hyperdown update schemas", {
        cwd: workspaceDir,
        stdio: "ignore",
      });

      const hdConfigArg = configPath
        ? resolve(process.cwd(), configPath)
        : join(workspaceDir, "hyperdown.config.json");

      if (existsSync(hdConfigArg)) {
        execSync(`hyperdown gen:db --path "${hdConfigArg}"`, {
          cwd: workspaceDir,
          stdio: "ignore",
        });
      }

      spinner.stop("All done! Types and database generated.");
    } catch (e: unknown) {
      spinner.stop(
        "Codegen skipped — run `hyperdown update schemas` and `hyperdown gen:db` manually.",
      );
      if (e instanceof Error) {
        scriptLog.warn({ err: e }, e.message);
      }
    }
  }
}
