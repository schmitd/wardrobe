import { expect, test } from "bun:test";
import fc from "fast-check";
import { validateOutfit, validateReviewedDays, sevenDays, shiftDay } from "@wardrobe/shared";
import { propertyOptions } from "./property-options";

const word = fc.string({ minLength: 1, maxLength: 40 }).filter(value => value.trim().length > 0);

test("fuzz: accepted recommendations contain only owned pieces and useful explanations", () => {
  fc.assert(fc.property(fc.uniqueArray(word, { maxLength: 12 }), fc.array(word, { maxLength: 12 }), fc.array(fc.string({ maxLength: 300 }), { maxLength: 8 }), (owned, proposed, missing) => {
    let result;
    try { result = validateOutfit({ title: "Synthetic outfit", rationale: "Synthetic explanation", itemIds: proposed, missing }, new Set(owned)); }
    catch { return; }
    expect(result.itemIds.every(id => owned.includes(id))).toBe(true);
    expect(new Set(result.itemIds).size).toBe(result.itemIds.length);
    expect(result.missing.every(text => text.trim().length > 0)).toBe(true);
    expect(result.itemIds.length + result.missing.length).toBeGreaterThan(0);
  }), propertyOptions);
  // Keep a positive control so rejecting every proposal can never satisfy this property.
  expect(validateOutfit({ title: "Outfit", rationale: "Own it", itemIds: ["own"], missing: [] }, new Set(["own"])).itemIds).toEqual(["own"]);
});

test("fuzz: reviewed dates stay unique and inside the chosen week across calendar boundaries", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 350 }), fc.array(fc.integer({ min: -10, max: 15 }), { minLength: 1, maxLength: 9 }), fc.string({ maxLength: 1205 }), (offset, dayOffsets, description) => {
    const now = new Date("2026-01-01T12:00:00Z");
    const week = shiftDay("2026-01-01", offset);
    const days = dayOffsets.map(day => ({ date: shiftDay(week, day), description }));
    let result;
    try { result = validateReviewedDays(days, "UTC", now, week); } catch { return; }
    expect(result.length).toBeLessThanOrEqual(7);
    expect(new Set(result.map(row => row.date)).size).toBe(result.length);
    expect(result.every(row => sevenDays(week).includes(row.date))).toBe(true);
    expect(result.every(row => row.description.length <= 1200)).toBe(true);
  }), propertyOptions);
  expect(validateReviewedDays([{ date: "2026-01-01", description: "予定" }], "UTC", new Date("2026-01-01T12:00:00Z"), "2026-01-01")).toHaveLength(1);
});
