import { describe, expect, it } from "bun:test";

import { createShutterDebouncer, normalizeVolume, workingVolumeFor } from "./volume-shutter-core";

describe("volume shutter policy", () => {
  it("keeps a working step available at either volume extreme", () => {
    expect(workingVolumeFor(0)).toBeGreaterThan(0);
    expect(workingVolumeFor(1)).toBeLessThan(1);
    expect(workingVolumeFor(0.42)).toBe(0.42);
  });

  it("normalizes invalid native values", () => {
    expect(normalizeVolume(Number.NaN)).toBe(0.5);
    expect(normalizeVolume(-2)).toBe(0);
    expect(normalizeVolume(3)).toBe(1);
  });

  it("accepts one shutter event per physical press window", () => {
    const accept = createShutterDebouncer(650);
    expect(accept(1_000)).toBe(true);
    expect(accept(1_020)).toBe(false);
    expect(accept(1_651)).toBe(true);
  });
});
