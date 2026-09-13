import { describe, expect, test } from "bun:test";
import { replayPrivacy, REPLAY_BLOCK_SELECTOR } from "./replay-privacy";

describe("replay privacy", () => {
  test("blocks photos, camera/video, canvas, embedded content and file inputs", () => {
    for (const selector of ["img", "picture", "video", "canvas", "iframe", 'input[type="file"]', 'input[type="hidden"]', "[data-private]"]) {
      expect(REPLAY_BLOCK_SELECTOR).toContain(selector);
    }
  });
  test("masks displayed text and inputs and suppresses network payloads", () => {
    expect(replayPrivacy.maskAllInputs).toBe(true);
    expect(replayPrivacy.maskTextSelector).toBe("*");
    expect(replayPrivacy.recordHeaders).toBe(false);
    expect(replayPrivacy.recordBody).toBe(false);
    expect(replayPrivacy.captureCanvas?.recordCanvas).toBe(false);
    expect(replayPrivacy.maskCapturedNetworkRequestFn?.({ name: "https://private/photo?token=secret" } as never)).toBeNull();
  });
  test("removes media URLs and content-bearing attributes", () => {
    for (const name of ["src", "srcset", "href", "poster", "alt", "title", "aria-label", "data-note", "value"]) {
      expect(replayPrivacy.maskAttributeFn?.(name, "private-photo-or-note")).toBe("[redacted]");
    }
    expect(replayPrivacy.maskAttributeFn?.("style", "background: url(secret-photo)")).toBe("");
    expect(replayPrivacy.maskAttributeFn?.("class", "grid gap-4")).toBe("grid gap-4");
  });
});
