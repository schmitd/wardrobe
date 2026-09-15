import { describe, expect, test } from "bun:test";
import {
  sevenDays,
  shiftDay,
  outfitForDay,
  validateReviewedDays,
  validateWeekInterpretation,
  type OutfitSuggestion,
} from "@wardrobe/shared";
const now = new Date("2026-09-15T16:00:00Z");
describe("week planning boundaries", () => {
  test("seven local dates cross month and DST boundaries", () => {
    expect(sevenDays("2026-10-29")).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("rejects duplicate dates, invalid dates, too many days and oversized context", () => {
    const day = { date: "2026-09-16", description: "Meeting" };
    expect(() => validateReviewedDays([day, day], "UTC", now)).toThrow();
    expect(() =>
      validateReviewedDays([{ ...day, date: "2026-02-30" }], "UTC", now),
    ).toThrow();
    expect(() =>
      validateReviewedDays(Array(8).fill(day), "UTC", now),
    ).toThrow();
    expect(() =>
      validateReviewedDays(
        [{ ...day, description: "x".repeat(1201) }],
        "UTC",
        now,
      ),
    ).toThrow();
  });
  test("model dates must fit the requested week; ambiguity requires review", () => {
    expect(() =>
      validateWeekInterpretation(
        {
          days: [{ date: "2026-09-23", description: "Dinner" }],
          clarification: "",
        },
        "2026-09-15",
        "UTC",
        now,
      ),
    ).toThrow();
    expect(
      validateWeekInterpretation(
        { days: [], clarification: "Which day?" },
        "2026-09-15",
        "UTC",
        now,
      ).clarification,
    ).toBe("Which day?");
  });
  test("committed outfits outrank newer suggestions and dismissed entries", () => {
    const row = (id: string, status: OutfitSuggestion["status"]) =>
      ({ id, status, date: "2026-09-16" }) as OutfitSuggestion;
    const rows = [
      row("new", "suggested"),
      row("planned", "planned"),
      row("old", "dismissed"),
    ];
    expect(outfitForDay(rows, "2026-09-16")?.id).toBe("planned");
    expect(outfitForDay([row("worn", "worn"), ...rows], "2026-09-16")?.id).toBe(
      "worn",
    );
  });
});
