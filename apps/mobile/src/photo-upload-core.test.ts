/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";

import { photoUploadEffect, PhotoUploadError, type PhotoUploadDependencies } from "./photo-upload-core";

type TestBody = { uri: string };

const dependencies = (overrides: Partial<PhotoUploadDependencies<TestBody>> = {}): PhotoUploadDependencies<TestBody> => ({
  prepare: async () => "file:///prepared.jpg",
  authorize: async () => ({ uploadUrl: "https://upload.example.test" }),
  open: (uri) => ({ uri }),
  transfer: async () => ({ ok: true, status: 200, json: async () => ({ storageId: "storage_123" }) }),
  ...overrides,
});

describe("native photo upload", () => {
  test("transfers the prepared native file and returns its storage id", async () => {
    const calls: unknown[] = [];
    const storageId = await Effect.runPromise(photoUploadEffect(dependencies({
      transfer: async (url, body) => {
        calls.push({ url, body });
        return { ok: true, status: 200, json: async () => ({ storageId: "storage_456" }) };
      },
    }), "file:///camera.jpg", 1600));

    expect(storageId).toBe("storage_456");
    expect(calls).toEqual([{ url: "https://upload.example.test", body: { uri: "file:///prepared.jpg" } }]);
  });

  test("keeps authorization failures distinct from transfer failures", async () => {
    const exit = await Effect.runPromiseExit(photoUploadEffect(dependencies({
      authorize: async () => { throw new Error("Sign in to continue."); },
    }), "file:///camera.jpg", 1600));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = exit.cause.toString();
      expect(failure).toContain("Sign in to continue.");
      expect(failure).toContain("PhotoUploadError");
    }
  });

  test("rejects a successful response without a Convex storage id", async () => {
    const exit = await Effect.runPromiseExit(photoUploadEffect(dependencies({
      transfer: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    }), "file:///camera.jpg", 1600));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("Upload did not return a photo reference.");
    }
  });

  test("reports the upload service status", async () => {
    const exit = await Effect.runPromiseExit(photoUploadEffect(dependencies({
      transfer: async () => ({ ok: false, status: 413, json: async () => ({}) }),
    }), "file:///camera.jpg", 1600));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain("Upload failed (413)");
      expect(error).toContain(PhotoUploadError.name);
    }
  });
});
