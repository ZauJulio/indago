import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { FrontmatterConfigManager } from "../../src/frontmatter/config.ts";
import { FrontmatterValidator } from "../../src/frontmatter/validator.ts";

// Real AJV compilation + real config/template files on disk — no mocks.

let dir: string;
let workspace: string;

function makeValidator(opts: { required?: boolean; templatesDir?: string } = {}) {
  writeFileSync(
    join(dir, "frontmatter.json"),
    JSON.stringify({
      "frontMatter.taxonomy.contentTypes": [
        {
          name: "article",
          fields: [
            { title: "Title", name: "title", type: "string", required: opts.required },
            { title: "Draft", name: "draft", type: "draft" },
            { title: "Tags", name: "tags", type: "tags" },
            {
              title: "Difficulty",
              name: "difficulty",
              type: "choice",
              choices: ["easy", "hard"],
            },
          ],
        },
      ],
      "frontMatter.content.pageFolders": [
        { title: "Articles", path: "[[workspace]]/content/article", contentTypes: ["article"] },
      ],
    }),
  );
  const cm = new FrontmatterConfigManager(join(dir, "frontmatter.json"));
  return new FrontmatterValidator(cm, workspace, opts.templatesDir);
}

const articleFile = () => join(workspace, "content", "article", "en", "post.mdx");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hd-validator-"));
  workspace = dir;
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("FrontmatterValidator", () => {
  test("accepts data with the correct field types", () => {
    const v = makeValidator();
    const res = v.validate(
      { title: "Hi", draft: false, tags: ["a", "b"], difficulty: "easy" },
      articleFile(),
    );
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  test("rejects a wrong-typed field (draft must be boolean, tags an array)", () => {
    const v = makeValidator();
    expect(v.validate({ title: "Hi", draft: "nope" }, articleFile()).isValid).toBe(false);
    expect(v.validate({ title: "Hi", tags: "not-an-array" }, articleFile()).isValid).toBe(false);
  });

  test("enforces the choice enum", () => {
    const v = makeValidator();
    expect(v.validate({ title: "Hi", difficulty: "easy" }, articleFile()).isValid).toBe(true);
    expect(v.validate({ title: "Hi", difficulty: "impossible" }, articleFile()).isValid).toBe(
      false,
    );
  });

  test("skips validation (isValid) for a path with no configured content folder", () => {
    const v = makeValidator();
    const res = v.validate({ anything: true }, join(workspace, "unrelated", "file.mdx"));
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  test("required flag on a field is enforced when no template is present", () => {
    const v = makeValidator({ required: true });
    expect(v.validate({ title: "present" }, articleFile()).isValid).toBe(true);
    expect(v.validate({ draft: false }, articleFile()).isValid).toBe(false); // missing title
  });

  test("derives required fields from a content-type template file", () => {
    const templatesDir = join(dir, "templates");
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(join(templatesDir, "article.md"), "---\ntitle: \ndifficulty: \n---\nBody\n");

    const v = makeValidator({ templatesDir });
    // Template keys (title, difficulty) become required.
    expect(v.validate({ title: "x", difficulty: "easy" }, articleFile()).isValid).toBe(true);
    expect(v.validate({ title: "x" }, articleFile()).isValid).toBe(false); // missing difficulty
  });
});
