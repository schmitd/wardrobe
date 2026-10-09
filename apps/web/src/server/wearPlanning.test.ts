import { expect, test } from "bun:test";
import { availablePieces, onWearCooldown, recommendationBackoff, wearPolicy, wearUsage } from "./wearPlanning";
const day = 86400000;
const shirt = { id: "shirt", category: "Shirt", wearPolicy: "rewear" as const, wearReadyAt: 9999999999999 };
const wear = [{ date: "2026-10-09", itemIds: ["shirt"], wornAt: 1 }];
test("actual wear has a seven-date boundary, independent of legacy overrides and future records", () => {
  expect(onWearCooldown(shirt, wear, "2026-10-08")).toBe(false);
  expect(onWearCooldown(shirt, wear, "2026-10-09")).toBe(true);
  expect(onWearCooldown(shirt, wear, "2026-10-15")).toBe(true);
  expect(onWearCooldown(shirt, wear, "2026-10-16")).toBe(false);
  for (const category of ["Running shoes", "Watch", "Accessories", "Bag", "Jacket", "Jewellery", "Scarf"]) expect(wearPolicy({ id: "x", category, wearPolicy: "after_each_wear" })).toBe("rewear");
  for (const category of ["Shirt", "Trousers", "Dress", "Sweater", "Cardigan", "Piece"]) expect(wearPolicy({ id: "x", category })).toBe("after_each_wear");
});
test("a cooled spare does not exclude the sole usable shirt, and sparse wardrobes retain owned pieces", () => {
  const spare = { id: "spare", category: "Top" };
  expect(availablePieces([shirt, spare], wear, "2026-10-10")).toEqual([spare]);
  expect(availablePieces([shirt], wear, "2026-10-10")).toEqual([shirt]);
  expect(availablePieces([shirt, spare], [...wear, { date: "2026-10-09", itemIds: ["spare"], wornAt: 2 }], "2026-10-10")).toEqual([shirt, spare]);
  expect(wearUsage([shirt], [...wear, ...wear]).get("shirt")).toBe(1);
});
test("removal backoff is gentle, bounded, decays and expires; future and unrelated signals are inert", () => {
  const signals = Array.from({ length: 20 }, () => ({ itemId: "shirt", at: day }));
  expect(recommendationBackoff("shirt", signals, day)).toBe(3);
  expect(recommendationBackoff("shirt", signals.slice(0,1), 8 * day)).toBe(0.5);
  expect(recommendationBackoff("shirt", signals, 29 * day)).toBe(0);
  expect(recommendationBackoff("other", signals, day)).toBe(0);
  expect(recommendationBackoff("shirt", signals, 0)).toBe(0);
});
