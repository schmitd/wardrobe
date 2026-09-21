import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGalleryHandler } from "./serve";

describe("private gallery host boundary", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "wardrobe-gallery-"));
    await Bun.write(join(root, "index.html"), "synthetic private marker");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("serves the gallery through a loopback Host", async () => {
    const response = await createGalleryHandler(root)(new Request("http://127.0.0.1:4918/", {
      headers: { Host: "127.0.0.1:4918" },
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("synthetic private marker");
  });

  test("rejects a non-loopback Host before reading the gallery", async () => {
    const response = await createGalleryHandler(root)(new Request("http://127.0.0.1:4918/", {
      headers: { Host: "attacker.example:4918" },
    }));

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("synthetic private marker");
  });
});
