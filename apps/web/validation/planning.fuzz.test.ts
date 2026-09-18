import { expect, test } from "bun:test";
import fc from "fast-check";
import { validateOutfit, validateReviewedDays, sevenDays, shiftDay } from "@wardrobe/shared";
import { propertyOptions } from "./property-options";

const word = fc.string({ minLength: 1, maxLength: 40 }).filter(value => value.trim().length > 0);

test("fuzz: accepted recommendations contain only owned pieces and useful explanations", () => {
  fc.assert(fc.property(
    fc.uniqueArray(word, { minLength: 1, maxLength: 12 }),
    fc.array(fc.nat(11), { minLength: 1, maxLength: 12 }),
    fc.array(word, { maxLength: 8 }),
    (owned, indices, missing) => {
      const proposed = indices.map(index => owned[index % owned.length]!);
      const input = { title: "Synthetic outfit", rationale: "Synthetic explanation", itemIds: proposed, missing };
      // Every generated case has a meaningful accepted control before corruption.
      const result = validateOutfit(input, new Set(owned));
      expect(result.itemIds.every(id => owned.includes(id))).toBe(true);
      expect(result.itemIds.length).toBe(new Set(proposed).size);
      expect(result.missing.every(text => text.trim().length > 0)).toBe(true);
      let foreign = "foreign";
      while (owned.includes(foreign)) foreign += "!";
      expect(() => validateOutfit({ ...input, itemIds: [foreign] }, new Set(owned))).toThrow();
      expect(() => validateOutfit({ ...input, missing: ["  "] }, new Set(owned))).toThrow();
    },
  ), propertyOptions);
});

test("fuzz: reviewed dates stay unique and inside the chosen week across calendar boundaries", () => {
  fc.assert(fc.property(
    fc.constantFrom("2026-12-28", "2028-02-25"),
    fc.integer({ min: 0, max: 350 }),
    fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
    fc.string({ maxLength: 1200 }),
    (start, offset, dayOffsets, description) => {
      const now = new Date(`${start}T12:00:00Z`);
      const week = shiftDay(start, offset);
      const days = dayOffsets.map(day => ({ date: shiftDay(week, day), description }));
      const result = validateReviewedDays(days, "UTC", now, week);
      expect(new Set(result.map(row => row.date)).size).toBe(days.length);
      expect(result.every(row => sevenDays(week).includes(row.date))).toBe(true);
      expect(() => validateReviewedDays([days[0], days[0]], "UTC", now, week)).toThrow();
      expect(() => validateReviewedDays([{ date: shiftDay(week, 7), description }], "UTC", now, week)).toThrow();
      expect(() => validateReviewedDays([{ ...days[0], description: "予定".repeat(601) }], "UTC", now, week)).toThrow();
    },
  ), propertyOptions);
});
