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

  it("falls back to a piece when the model returns an invalid scope", () => {
    expect(normalizeCaptureRoute({ capture_scope: "unknown", confidence: 4 })).toMatchObject({
      scope: "single_piece",
      confidence: 1,
      needsReview: false,
    });
  });
});
