/**
 * Next.js adapter for HyperDown. Reproduces the Vite plugin's `buildStart` work
 * (codegen → writer → copy `.db`) plus virtual-module/SQLite wiring for Next:
 *   - {@link runHyperDownNextCodegen} — run from `predev`/`prebuild`.
 *   - {@link withHyperDown} — wrap `next.config` to apply the webpack glue.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HyperDownCodegen } from "../frontmatter/codegen.ts";
import { nextModulesFile } from "./templates.ts";

// ─── Codegen (predev / prebuild) ─────────────────────────────────────────────

interface HyperdownConfigShape {
  database?: { contentDir?: string; frontmatterJsonPath?: string };
}
interface FrontmatterShape {
  "frontMatter.taxonomy.contentTypes"?: Array<{ name: string }>;
}

export interface NextCodegenOptions {
  /** App root (where `hyperdown.config.json` lives). Defaults to `process.cwd()`. */
  root?: string;
  /** Config filename relative to `root`. Defaults to `hyperdown.config.json`. */
  configFile?: string;
  /** Folder (relative to `root`) the prebuilt `.db` files are copied into so the
   *  SSR client can read them at `/<metadataDir>/<type>.db`. Defaults to `metadata`. */
  metadataDir?: string;
}

function listMdx(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listMdx(full);
    return full.endsWith(".mdx") ? [full] : [];
  });
}

/**
 * Rewrite a type's generated `.hyper-down/content/<type>/modules.ts` from Vite's
 * `import.meta.glob` (which the in-process codegen emits) to explicit eager
 * `@next/mdx` imports, since Next has no Vite glob transform.
 */
function writeNextModules(type: string, root: string, contentDir: string): void {
  const typeContentDir = join(root, contentDir.replace(/^\.\//, ""), type);
  const files = listMdx(typeContentDir).sort();
  const modulesDir = join(root, ".hyper-down", "content", type);
  const modulesPath = join(modulesDir, "modules.ts");

  const imports: string[] = [];
  const entries: string[] = [];
  files.forEach((file, i) => {
    const importPath = relative(modulesDir, file).replace(/\\/g, "/");
    // Resolver key must end with `/<lang>/<slug>.mdx`.
    const key = "/" + relative(root, file).replace(/\\/g, "/");
    imports.push(
      `import * as m${i} from "${importPath.startsWith(".") ? importPath : "./" + importPath}";`,
    );
    entries.push(`  "${key}": m${i},`);
  });

  writeFileSync(modulesPath, nextModulesFile(imports, entries));
}

/** Resolve the writer script shipped alongside this module. This adapter is a
 *  top-level dist entry (`dist/next.js`), so the writer sits under `./src/`, not
 *  `../`. Probe every layout (source, top-level entry, nested chunk); first wins. */
function resolveWriterScript(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../frontmatter/writer.ts"), // source: src/plugins → src/frontmatter
    resolve(here, "src/frontmatter/writer.js"), // dist entry: dist → dist/src/frontmatter
    resolve(here, "../frontmatter/writer.js"), // dist chunk: dist/src/plugins → dist/src/frontmatter
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(
      `HyperDown: could not locate the SQLite writer script. Looked in:\n${candidates.join("\n")}`,
    );
  }
  return found;
}

/**
 * Run HyperDown's content pipeline for a Next app: in-process type codegen,
 * the SQLite writer (spawned under `bun` for `bun:sqlite`), the Next-compatible
 * `modules.ts` rewrite, and the `.db` copy into the served metadata folder.
 */
export function runHyperDownNextCodegen(options: NextCodegenOptions = {}): void {
  const root = options.root ?? process.cwd();
  const configFile = options.configFile ?? "hyperdown.config.json";
  const metadataDirName = options.metadataDir ?? "metadata";

  // 1. Type codegen (.hyper-down/**) — node:fs only, runs in-process.
  new HyperDownCodegen(root).generate();

  // 2. SQLite writer — spawned under bun so `bun:sqlite` is available.
  const writer = spawnSync("bun", [resolveWriterScript(), configFile], {
    stdio: "inherit",
    cwd: root,
  });
  if (writer.status !== 0) process.exit(writer.status ?? 1);

  // 3 + 4. Next-compatible modules + copy each `.db` into the served folder.
  const hdConfig = JSON.parse(readFileSync(join(root, configFile), "utf8")) as HyperdownConfigShape;
  const contentDir = hdConfig.database?.contentDir ?? "./content";
  const fmPath = hdConfig.database?.frontmatterJsonPath ?? "./frontmatter.json";
  const fm = JSON.parse(readFileSync(join(root, fmPath), "utf8")) as FrontmatterShape;
  const types = (fm["frontMatter.taxonomy.contentTypes"] ?? []).map((t) => t.name);

  const metadataDir = join(root, metadataDirName);
  mkdirSync(metadataDir, { recursive: true });
  for (const type of types) {
    writeNextModules(type, root, contentDir);
    const db = join(root, contentDir.replace(/^\.\//, ""), type, `${type}.db`);
    if (existsSync(db)) copyFileSync(db, join(metadataDir, `${type}.db`));
  }
}

// ─── next.config webpack glue ────────────────────────────────────────────────

/** The subset of the webpack runtime instance `withHyperDown` constructs. */
interface WebpackInstance {
  NormalModuleReplacementPlugin: new (re: RegExp, newResource: string) => unknown;
  ContextReplacementPlugin: new (re: RegExp, dir: string, map: unknown) => unknown;
  IgnorePlugin: new (opts: { resourceRegExp: RegExp }) => unknown;
}

/** The subset of Next's webpack config object `withHyperDown` mutates. */
interface WebpackConfig {
  plugins: unknown[];
  externals?: unknown[];
  ignoreWarnings?: unknown[];
}

/** Minimal structural shape of a Next config — avoids depending on `next`. */
export interface HyperDownNextConfig {
  pageExtensions?: string[];
  serverExternalPackages?: string[];
  webpack?: (config: WebpackConfig, ctx: { webpack: WebpackInstance }) => WebpackConfig;
  [key: string]: unknown;
}

export interface WithHyperDownOptions {
  /** App root, used to resolve the shim files. Defaults to `process.cwd()`. */
  appDir?: string;
  /** Directory (relative to `appDir`) holding the webpack shims. Defaults to `src/lib`. */
  libDir?: string;
}

/**
 * Wrap a Next config with HyperDown's webpack glue: rewrite the two Vite virtual
 * modules to shims, redirect the computed `${runtime}:sqlite` import to CJS shims,
 * keep the SQLite builtins external + silence benign warnings, enable `.mdx` pages
 * and externalize pino. A user `webpack` callback runs after this glue.
 */
export function withHyperDown<T extends object = HyperDownNextConfig>(
  nextConfig: T = {} as T,
  options: WithHyperDownOptions = {},
): T {
  const appDir = options.appDir ?? process.cwd();
  const libDir = resolve(appDir, options.libDir ?? "src/lib");
  const cfg = nextConfig as HyperDownNextConfig;
  const userWebpack = cfg.webpack;

  const merged: HyperDownNextConfig = {
    ...cfg,
    pageExtensions: cfg.pageExtensions ?? ["ts", "tsx", "mdx"],
    serverExternalPackages: [
      ...new Set([...(cfg.serverExternalPackages ?? []), "pino", "pino-pretty"]),
    ],
    webpack(config: WebpackConfig, ctx: { webpack: WebpackInstance }) {
      const { webpack } = ctx;
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^virtual:hyperdown-collections$/,
          join(libDir, "hyperdown-collections.ts"),
        ),
        new webpack.NormalModuleReplacementPlugin(
          /^virtual:hyperdown-frontmatter$/,
          join(libDir, "hyperdown-frontmatter.ts"),
        ),
        // mermaid is an optional, diagram-only peer dep — not shipped here.
        new webpack.IgnorePlugin({ resourceRegExp: /^mermaid$/ }),
        // The engine opens SQLite via a computed `import(`${runtime}:sqlite`)`;
        // redirect that webpack context to CJS shims that require the builtins.
        new webpack.ContextReplacementPlugin(
          /@virtus[\\/]hyper-down[\\/].*[\\/]db[\\/]client/,
          libDir,
          { "node:sqlite": "./sqlite-node.cjs", "bun:sqlite": "./sqlite-bun.cjs" },
        ),
      );

      config.externals = [
        ...(config.externals ?? []),
        { "bun:sqlite": "commonjs bun:sqlite", "node:sqlite": "commonjs node:sqlite" },
      ];

      config.ignoreWarnings = [
        ...(config.ignoreWarnings ?? []),
        { message: /topLevelAwait/ },
        { message: /Critical dependency: the request of a dependency is an expression/ },
      ];

      return userWebpack ? userWebpack(config, ctx) : config;
    },
  };

  return merged as T;
}
