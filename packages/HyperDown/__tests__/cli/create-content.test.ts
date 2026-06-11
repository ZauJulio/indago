import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanup, makeTempProject, runCli } from "../helpers.ts";

// Real CLI, real frontmatter.json mutations on disk — no mocks.

let dir: string;
const readFm = () => JSON.parse(readFileSync(join(dir, "frontmatter.json"), "utf-8"));

beforeEach(() => {
  dir = makeTempProject();
  runCli(["create-frontmatter", "--name", "article", "--content-dir", "content"], dir);
  writeFileSync(
    join(dir, "hyperdown.config.json"),
    JSON.stringify({
      database: { contentDir: "./content", frontmatterJsonPath: "frontmatter.json" },
    }),
  );
});

afterEach(() => cleanup(dir));

describe("hyperdown create-content", () => {
  test("appends a new content type with parsed fields to frontmatter.json", () => {
    const res = runCli(
      [
        "create-content",
        "--name",
        "recipe",
        "--folder",
        "Recipes",
        "--fields",
        "title:string:req,cuisine:choice:opt,tags:tags:opt",
        "--path",
        "hyperdown.config.json",
      ],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const types = readFm()["frontMatter.taxonomy.contentTypes"] as {
      name: string;
      fields: { name: string; type: string; required?: boolean }[];
    }[];
    const recipe = types.find((t) => t.name === "recipe");
    expect(recipe).toBeDefined();
    expect(recipe?.fields.map((f) => f.name)).toEqual(["title", "cuisine", "tags"]);

    const title = recipe?.fields.find((f) => f.name === "title");
    expect(title?.type).toBe("string");
    expect(title?.required).toBe(true);
  });

  test("keeps the previously-scaffolded article type intact", () => {
    runCli(
      [
        "create-content",
        "--name",
        "recipe",
        "--folder",
        "Recipes",
        "--fields",
        "title:string",
        "--path",
        "hyperdown.config.json",
      ],
      dir,
    );
    const names = (readFm()["frontMatter.taxonomy.contentTypes"] as { name: string }[]).map(
      (t) => t.name,
    );
    expect(names).toContain("article");
    expect(names).toContain("recipe");
  });
});

describe("hyperdown create-item", () => {
  test("creates a scaffolded .mdx for a content type and locale (path resolved from config dir)", () => {
    // Regression: `frontmatterJsonPath` must resolve relative to the config
    // directory, not the workspace root — a path-resolution bug created the file
    // two dirs too high (or failed with ENOENT).
    const res = runCli(
      [
        "create-item",
        "--type",
        "article",
        "--slug",
        "hello-world",
        "--lang",
        "en",
        "--path",
        "hyperdown.config.json",
      ],
      dir,
    );
    expect(res.exitCode).toBe(0);

    const file = join(dir, "content", "article", "en", "hello-world.mdx");
    const body = readFileSync(file, "utf-8");
    expect(body).toContain("---");
    expect(body).toContain("title:");
  });

  test("creates the locale-prefixed path for a non-default locale", () => {
    const res = runCli(
      [
        "create-item",
        "--type",
        "article",
        "--slug",
        "ola-mundo",
        "--lang",
        "pt-BR",
        "--path",
        "hyperdown.config.json",
      ],
      dir,
    );
    expect(res.exitCode).toBe(0);
    expect(() =>
      readFileSync(join(dir, "content", "article", "pt-BR", "ola-mundo.mdx"), "utf-8"),
    ).not.toThrow();
  });
});
