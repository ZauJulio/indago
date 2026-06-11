import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanup, makeTempProject, runCli } from "../helpers.ts";

let dir: string;
beforeEach(() => {
  dir = makeTempProject();
});
afterEach(() => cleanup(dir));

describe("hyperdown update", () => {
  // The `update schemas` happy path downloads the FrontMatter schemas over the
  // network, so it is intentionally not exercised here. We assert the hermetic,
  // network-free contract instead: an unrecognized target fails loudly.
  test("exits non-zero for an unknown target", () => {
    const res = runCli(["update", "bogus"], dir);

    expect(res.exitCode).toBe(1);
    expect(`${res.stdout}${res.stderr}`).toContain("Unknown update target");
  });
});
