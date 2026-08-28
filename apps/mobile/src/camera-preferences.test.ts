import { describe, expect, it } from "bun:test";

import { normalizeCameraFacing } from "./camera-preferences-core";

describe("camera preferences", () => {
  it("restores a supported saved lens", () => {
    expect(normalizeCameraFacing("front", "back")).toBe("front");
    expect(normalizeCameraFacing("back", "front")).toBe("back");
  });

  it("uses the screen-specific fallback for missing or invalid values", () => {
    expect(normalizeCameraFacing(null, "front")).toBe("front");
    expect(normalizeCameraFacing("external", "back")).toBe("back");
  });
});
