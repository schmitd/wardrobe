import { expect, test } from "bun:test";
import { mkdtemp, mkdir, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePrivateCaptureOutput, resolvePrivateCaptureOutput } from "./private-capture-output";

test("private captures cannot escape the actual ignored roots through a substring or traversal", () => {
  const root = "/workspace/wardrobe";
  for (const path of ["not-output/private", "output/../../public", "../outside/output/private"]) {
    expect(() => resolvePrivateCaptureOutput(path, root, root)).toThrow("ignored output");
  }
  expect(resolvePrivateCaptureOutput("../../output/private", root, `${root}/apps/web`).directory).toBe(`${root}/output/private`);
  expect(resolvePrivateCaptureOutput("output/private", root, `${root}/apps/web`).directory).toBe(`${root}/apps/web/output/private`);
});

test("private captures reject symlink output and allow an ordinary private directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "capture-output-")));
  try {
    await mkdir(join(root, "outside"));
    await mkdir(join(root, "output"));
    await symlink(join(root, "outside"), join(root, "output/link"));
    await expect(preparePrivateCaptureOutput("output/link", root, root)).rejects.toThrow("symlinks");
    expect(await preparePrivateCaptureOutput("output/private", root, root)).toBe(join(root, "output/private"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
