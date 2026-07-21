import { describe, expect, it } from "bun:test";

import { publicCaptureError, toMobileCaptureFailure } from "./mobileCaptureError";

describe("mobile capture errors", () => {
  it("returns a useful 429 for an exhausted routing allowance", () => {
    expect(publicCaptureError(toMobileCaptureFailure(new Error("Photo routing limit reached for your plan."))))
      .toEqual({ status: 429, message: "Photo routing limit reached for your plan." });
  });

  it("does not expose unexpected inference details", () => {
    expect(publicCaptureError(toMobileCaptureFailure(new Error("provider secret detail"))))
      .toEqual({ status: 500, message: "Could not save this photo right now." });
  });
});
