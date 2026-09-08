import { describe, expect, it } from "bun:test";
import { safeProperties, screenName } from "./analytics-core";

describe("native analytics privacy boundary", () => {
  it("drops credentials, photos, free text, arbitrary properties and invalid dimensions", () => {
    expect(safeProperties({ password: "secret", email: "person@example.com", uri: "file://photo.jpg", error: "token=secret", bio: "private", source: "private.jpg", operation: "private name", stage: "private error" })).toEqual({});
  });
  it("retains useful bounded funnel dimensions", () => {
    expect(safeProperties({ intent: "my_wardrobe", scope: "full_fit", duration_ms: 3500, attempt: 2, status: 429, onboarding: true, trace_id: "a".repeat(32) })).toEqual({ intent: "my_wardrobe", scope: "full_fit", duration_ms: 3500, attempt: 2, status: 429, onboarding: true, trace_id: "a".repeat(32) });
  });
  it("rejects nonfinite numbers and invalid trace IDs", () => {
    expect(safeProperties({ duration_ms: Infinity, confidence: NaN, trace_id: "native-123" })).toEqual({});
    expect(safeProperties({ trace_id: "0".repeat(32) })).toEqual({});
  });
  it("uses screen templates, never customer IDs or route parameters", () => {
    expect(screenName(["(tabs)", "wardrobe"])).toBe("wardrobe");
    expect(screenName(["item", "[id]"])).toBe("item/[id]");
    expect(screenName(["item", "private-id"])).toBe("other");
    expect(screenName(["capture", "processing?uri=secret"])).toBe("other");
  });
});
