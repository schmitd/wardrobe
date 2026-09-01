import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import {
  applyDirectGarmentComparison,
  classifyGarmentMatch,
  cropGarmentRegion,
  normalizeGarmentCategory,
  shouldDirectlyCompareGarments,
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

  it("uses direct comparison only as a conservative ambiguity fallback", () => {
    const candidates = [
      { wardrobeItemId: "item-a", score: 0.89, imageUrl: "https://example.com/a.jpg" },
      { wardrobeItemId: "item-b", score: 0.87, imageUrl: "https://example.com/b.jpg" },
    ];
    const embeddingDecision = classifyGarmentMatch(candidates);
    expect(shouldDirectlyCompareGarments(embeddingDecision, candidates)).toBe(true);
    expect(shouldDirectlyCompareGarments(classifyGarmentMatch([
      { wardrobeItemId: "item-a", score: 0.97, imageUrl: "https://example.com/a.jpg" },
      { wardrobeItemId: "item-b", score: 0.70, imageUrl: "https://example.com/b.jpg" },
    ]), candidates)).toBe(false);
    expect(shouldDirectlyCompareGarments(classifyGarmentMatch([
      { wardrobeItemId: "item-a", score: 0.51, imageUrl: "https://example.com/a.jpg" },
    ]), candidates)).toBe(false);
    expect(applyDirectGarmentComparison(embeddingDecision, candidates, {
      matchIndex: 1,
      confidence: 0.95,
      rationale: "The same unique seam and print are visible.",
    })).toMatchObject({ status: "auto_matched", wardrobeItemId: "item-b", confidence: 0.95 });
  });

  it("does not override embeddings with an uncertain or invalid model answer", () => {
    const candidates = [
      { wardrobeItemId: "item-a", score: 0.85, imageUrl: "https://example.com/a.jpg" },
    ];
    const embeddingDecision = classifyGarmentMatch(candidates);
    expect(applyDirectGarmentComparison(embeddingDecision, candidates, {
      matchIndex: 0,
      confidence: 0.81,
      rationale: "Possibly the same item.",
    })).toEqual(embeddingDecision);
    expect(applyDirectGarmentComparison(embeddingDecision, candidates, {
      matchIndex: 9,
      confidence: 0.99,
      rationale: "Invalid candidate.",
    })).toEqual(embeddingDecision);
  });

  it("turns a confident exact-item none result into unresolved instead of correction UI", () => {
    const candidates = [
      { wardrobeItemId: "item-a", score: 0.88, imageUrl: "https://example.com/a.jpg" },
      { wardrobeItemId: "item-b", score: 0.86, imageUrl: "https://example.com/b.jpg" },
    ];
    const embeddingDecision = classifyGarmentMatch(candidates);
    expect(applyDirectGarmentComparison(embeddingDecision, candidates, {
      matchIndex: -1,
      confidence: 0.96,
      rationale: "Neither candidate has the query's distinctive buttons.",
    })).toMatchObject({ status: "unresolved", confidence: 0.96 });
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
