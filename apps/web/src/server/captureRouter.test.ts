import { describe, expect, it } from "bun:test";

import {
  CAPTURE_ROUTE_AUTO_CONFIDENCE,
  normalizeCaptureRoute,
} from "./captureRouter";

describe("capture router policy", () => {
  it("lets a confident visual classification proceed agent-first", () => {
    expect(
      normalizeCaptureRoute({
        capture_scope: "full_fit",
        confidence: CAPTURE_ROUTE_AUTO_CONFIDENCE + 0.1,
        rationale: "Several garments are worn together.",
      })
    ).toEqual({
      scope: "full_fit",
      confidence: CAPTURE_ROUTE_AUTO_CONFIDENCE + 0.1,
      needsReview: false,
      rationale: "Several garments are worn together.",
    });
  });

  it("asks for a nudge when confidence is low", () => {
    expect(
      normalizeCaptureRoute({
        capture_scope: "single_piece",
        confidence: 0.52,
        rationale: "The framing is close.",
      })
    ).toMatchObject({ scope: "single_piece", confidence: 0.52, needsReview: true });
  });

  it("does not silently route an invalid model response", () => {
    expect(normalizeCaptureRoute({ capture_scope: "unknown", confidence: 4 })).toMatchObject({
      scope: "single_piece",
      confidence: 1,
      needsReview: true,
    });
  });
});
