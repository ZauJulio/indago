import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { sitemapLog } from "../utils/logger.server.ts";
import { validateConfig } from "../utils/validator.ts";

// ─── Types ──────────────────────────────────────────────────

interface SitemapRoute {
  path: string;
  priority: string;
  changefreq: string;
}

interface SitemapContentType {
  name: string;
  basePath: string;
  priority: string;
  changefreq: string;
}

interface SitemapConfig {
  siteUrl: string;
  outputPath: string;
  staticRoutes: SitemapRoute[];
  contentTypes: SitemapContentType[];
}

interface I18nConfig {
  defaultLocale: string;
  locales: string[];
  strategy?: "folder" | "filePattern";
  filePattern?: Record<string, string>;
}

interface HyperDownConfig {
  database: { contentDir: string };
  sitemap: SitemapConfig;
  i18n: I18nConfig;
}

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

export interface HyperDownSitemapPluginOptions {
  configPath?: string;
}

// ─── Helpers ────────────────────────────────────────────────

interface HyperDownSitemapPlugin {
  name: string;
  apply: "build" | "serve";
  closeBundle: () => void;
}

let _sitemapRan = false;

export function hyperdownSitemapPlugin(
  options: HyperDownSitemapPluginOptions = {},
): HyperDownSitemapPlugin {
  return {
    name: "vite-plugin-hyperdown-sitemap",
    apply: "build",
    closeBundle() {
      if (_sitemapRan) return;
      _sitemapRan = true;

      sitemapLog.info("Validating config and generating sitemap during Vite build...");

      const configPath = options.configPath
        ? resolve(process.cwd(), options.configPath)
        : resolve(process.cwd(), "hyperdown.config.json");

      let config: HyperDownConfig;
      try {
        config = validateConfig(configPath) as unknown as HyperDownConfig;
      } catch {
        sitemapLog.warn("hyperdown.config.json not found or invalid. Sitemap generation disabled.");
        return;
      }

      const CONFIG_DIR = resolve(configPath, "..");
      const { sitemap: sitemapConfig, i18n: i18nConfig } = config;
      const CONTENT_DIR = resolve(CONFIG_DIR, config.database.contentDir);
      const OUTPUT_PATH = resolve(CONFIG_DIR, sitemapConfig.outputPath);

      function getMarkdownFiles(dir: string): string[] {
        const files: string[] = [];
        try {
          const items = readdirSync(dir);
          for (const item of items) {
            const fullPath = join(dir, item);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
              files.push(...getMarkdownFiles(fullPath));
            } else if (extname(item) === ".md" || extname(item) === ".mdx") {
              files.push(fullPath);
            }
          }
        } catch (error) {
          sitemapLog.error({ dir, error }, "Failed to read directory");
        }
        return files;
      }

      function extractFrontmatter(content: string): Record<string, string> | null {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return null;
        const frontmatter: Record<string, string> = {};
        const lines = match[1].split("\n");

        for (const line of lines) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line
              .slice(colonIndex + 1)
              .trim()
              .replace(/^['"]|['"]$/g, "");
            frontmatter[key] = value;
          }
        }
        return frontmatter;
      }

      function getFileLastModified(filePath: string): string {
        try {
          const stats = statSync(filePath);
          return stats.mtime.toISOString().split("T")[0];
        } catch {
          return new Date().toISOString().split("T")[0];
        }
      }

      function getLocalePrefix(filename: string): string {
        const getPrefix = (locale: string) => locale.split("-")[0];

        if (i18nConfig.strategy === "folder") {
          const sep = typeof process !== "undefined" && process.platform === "win32" ? "\\" : "/";
          const parts = filename.split(sep);

          if (parts.length > 1) {
            const dir = parts[parts.length - 2];
            const isDefaultLocale = dir === i18nConfig.defaultLocale;

            const includeDir = i18nConfig.locales.includes(dir);

            if (includeDir && !isDefaultLocale) return `/${getPrefix(dir)}`;
          }
        } else if (i18nConfig.filePattern) {
          for (const [locale, pattern] of Object.entries(i18nConfig.filePattern)) {
            if (filename.endsWith(pattern)) return `/${getPrefix(locale)}`;
          }
        }
        return "";
      }

      function deriveSlug(filename: string): string {
        if (i18nConfig.strategy === "folder") {
          return basename(filename).replace(/\.mdx?$/, "");
        }

        let slug = basename(filename);

        if (i18nConfig.filePattern) {
          for (const pattern of Object.values(i18nConfig.filePattern)) {
            const exp = new RegExp(`${pattern.replace(".", "\\.")}$`);
            slug = slug.replace(exp, "");
          }
        }

        return slug.replace(/\.mdx?$/, "");
      }

      function generateSitemap(): { xml: string; urls: SitemapUrl[] } {
        const urls: SitemapUrl[] = [];
        const today = new Date().toISOString().split("T")[0];

        for (const route of sitemapConfig.staticRoutes) {
          urls.push({
            loc: `${sitemapConfig.siteUrl}${route.path}`,
            lastmod: today,
            changefreq: route.changefreq,
            priority: route.priority,
          });
        }

        for (const typeConfig of sitemapConfig.contentTypes) {
          const contentType = typeConfig.name;
          const contentDir = join(CONTENT_DIR, contentType);
          const files = getMarkdownFiles(contentDir);

          sitemapLog.info({ contentType, count: files.length }, "Found md/mdx files for sitemap");

          for (const file of files) {
            try {
              const content = readFileSync(file, "utf-8");
              const frontmatter = extractFrontmatter(content);
              const slug = deriveSlug(file);

              const lastmod = frontmatter?.date || getFileLastModified(file);
              const pathPrefix = getLocalePrefix(file);

              urls.push({
                loc: `${sitemapConfig.siteUrl}${pathPrefix}${typeConfig.basePath}/${slug}`,
                lastmod,
                changefreq: typeConfig.changefreq,
                priority: typeConfig.priority,
              });
            } catch (err) {
              sitemapLog.warn(
                { file, error: (err as Error).message },
                "Skipping file due to error",
              );
            }
          }
        }

        const urlEntries = urls
          .map(
            (url) =>
              `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${url.lastmod}</lastmod>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
        return { xml, urls };
      }

      try {
        const result = generateSitemap();
        writeFileSync(OUTPUT_PATH, result.xml);

        sitemapLog.info(
          { outputPath: OUTPUT_PATH, totalUrls: result.urls.length },
          "Sitemap written successfully",
        );

        for (const url of result.urls) {
          sitemapLog.debug({ path: url.loc.replace(sitemapConfig.siteUrl, "") }, "URL entry");
        }
      } catch (e) {
        sitemapLog.fatal({ error: (e as Error).message }, "Sitemap generation failed");
      }
    },
  };
}
