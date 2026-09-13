import { describe, expect, test } from "bun:test";
import {
  CALENDAR_SCOPES,
  validateOutfit,
  validatePlanningDate,
} from "@wardrobe/shared";

describe("planning contracts", () => {
  const owned = new Set(["shirt", "trousers", "shoes"]);
  const outfit = {
    title: "A day out",
    rationale: "Use your familiar pieces.",
    itemIds: ["shirt", "trousers", "shoes"],
    missing: [],
  };
  test("rejects invented/foreign pieces and malformed model responses", () => {
    expect(() =>
      validateOutfit({ ...outfit, itemIds: ["someone-elses-coat"] }, owned),
    ).toThrow();
    expect(() => validateOutfit(null, owned)).toThrow();
    expect(() =>
      validateOutfit({ ...outfit, rationale: "x".repeat(2401) }, owned),
    ).toThrow();
    expect(() => validateOutfit({ ...outfit, itemIds: [] }, owned)).toThrow();
  });
  test("accepts honest incomplete inventory and deduplicates owned pieces", () => {
    expect(
      validateOutfit(
        {
          ...outfit,
          itemIds: [],
          missing: ["Add a top and bottoms to your wardrobe first."],
        },
        new Set(),
      ).missing,
    ).toHaveLength(1);
    expect(
      validateOutfit({ ...outfit, itemIds: ["shirt", "shirt"] }, owned).itemIds,
    ).toEqual(["shirt"]);
  });
  test("uses the user's local date and limits automatic near-term dates", () => {
    const now = new Date("2026-09-13T01:00:00Z");
    expect(
      validatePlanningDate("2026-09-12", "America/New_York", now).nearTerm,
    ).toBe(true);
    expect(
      validatePlanningDate("2026-09-26", "America/New_York", now).nearTerm,
    ).toBe(false);
    expect(() =>
      validatePlanningDate("2026-09-11", "America/New_York", now),
    ).toThrow();
    expect(() => validatePlanningDate("2028-09-13", "UTC", now)).toThrow();
    expect(() => validatePlanningDate("2026-02-30", "UTC", now)).toThrow();
    expect(() =>
      validatePlanningDate("2026-09-13", "invalid/timezone", now),
    ).toThrow();
  });
  test("requests only events and calendar-list read access", () => {
    expect(CALENDAR_SCOPES).toEqual([
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ]);
  });
});
