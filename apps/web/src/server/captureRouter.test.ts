import { describe, expect, it } from "bun:test";

import { normalizeCaptureRoute } from "./captureRouter";

describe("capture router policy", () => {
  it("lets a confident visual classification proceed agent-first", () => {
    expect(
      normalizeCaptureRoute({
        capture_scope: "full_fit",
        confidence: 0.84,
        rationale: "Several garments are worn together.",
      })
    ).toEqual({
      scope: "full_fit",
      confidence: 0.84,
      needsReview: false,
      rationale: "Several garments are worn together.",
    });
  });

  it("applies the agent decision when confidence is low", () => {
    expect(
      normalizeCaptureRoute({
        capture_scope: "single_piece",
        confidence: 0.52,
        rationale: "The framing is close.",
      })
    ).toMatchObject({ scope: "single_piece", confidence: 0.52, needsReview: false });
  });

  it("never turns an invalid route into a generic catalog item", () => {
    expect(normalizeCaptureRoute({ capture_scope: "unknown", confidence: 4 })).toMatchObject({
      scope: "full_fit",
      confidence: 1,
      needsReview: false,
    });
  });
  it("decomposes multiple visible garments even if the route label says one piece", () => {
    expect(normalizeCaptureRoute({ capture_scope: "single_piece", visible_garment_count: 3, confidence: 0.9 }).scope).toBe("full_fit");
  });
  it("preserves a coordinated catalog set while decomposing an ordinary worn outfit", () => {
    const set = { capture_scope: "single_piece", visible_garment_count: 2, confidence: 0.9 };
    expect(normalizeCaptureRoute({ ...set, is_catalog_set: true }).scope).toBe("single_piece");
    expect(normalizeCaptureRoute({ ...set, is_catalog_set: false }).scope).toBe("full_fit");
    expect(normalizeCaptureRoute({ ...set, is_catalog_set: "true" }).scope).toBe("full_fit");
  });
});
