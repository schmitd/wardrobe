import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import {
  classifyGarmentMatch,
  cropGarmentRegion,
  normalizeGarmentCategory,
} from "./garmentIdentity";

describe("garment identity policy", () => {
  it("only auto-links a strong and unambiguous visual match", () => {
    expect(classifyGarmentMatch([
      { wardrobeItemId: "item-a", score: 0.95 },
      { wardrobeItemId: "item-b", score: 0.82 },
    ])).toMatchObject({ status: "auto_matched", wardrobeItemId: "item-a" });

    expect(classifyGarmentMatch([
      { wardrobeItemId: "item-a", score: 0.95 },
      { wardrobeItemId: "item-b", score: 0.92 },
    ])).toMatchObject({ status: "needs_confirmation" });
  });

  it("keeps weak evidence unresolved", () => {
    expect(classifyGarmentMatch([{ wardrobeItemId: "item-a", score: 0.6 }])).toMatchObject({ status: "unresolved" });
  });

  it("normalizes detector categories for retrieval filters", () => {
    expect(normalizeGarmentCategory("  Outer Wear / Jacket ")).toBe("outerwear");
    expect(normalizeGarmentCategory("blue button-down shirt")).toBe("top");
  });

  it("creates a bounded jpeg crop from normalized coordinates", async () => {
    const source = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: "#d946ef" },
    }).png().toBuffer();
    const crop = await cropGarmentRegion(source, { x: 0.25, y: 0.2, width: 0.3, height: 0.4 });
    const metadata = await sharp(crop).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeLessThanOrEqual(768);
    expect(metadata.height).toBeLessThanOrEqual(768);
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });
});
