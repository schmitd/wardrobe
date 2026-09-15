import { describe, expect, it } from "bun:test";
import {
  addDays,
  calendarEvent,
  initialState,
  interpretWeek,
  localDay,
  reducer,
  restoreState,
  sampleDay,
  weekDays,
} from "./model";
describe("week-first native prototype", () => {
  it("shows exactly seven consecutive local days across month and DST boundaries", () => {
    expect(weekDays("2026-10-29")).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
  });
  it("maps several dictated weekdays to the visible week", () => {
    const result = interpretWeek(sampleDay, "2026-09-15");
    expect(result.unresolved).toBe(false);
    expect(result.notes.map((n) => n.day)).toEqual([
      "2026-09-16",
      "2026-09-18",
      "2026-09-20",
    ]);
  });
  it("does not silently choose ambiguous relative dates", () => {
    expect(interpretWeek("Tomorrow dinner", "2026-09-15").unresolved).toBe(
      true,
    );
    expect(
      interpretWeek("Next week Wednesday dinner", "2026-09-15").unresolved,
    ).toBe(true);
  });
  it("combines repeated day mentions without duplicate updates", () => {
    expect(
      interpretWeek("Friday work. Friday dinner", "2026-09-15").notes,
    ).toEqual([{ day: "2026-09-18", text: "work; dinner" }]);
  });
  it("keeps week, dictated draft and review through Calendar return and reload", () => {
    const s = {
      ...initialState(),
      week: "2026-09-15",
      description: sampleDay,
      review: interpretWeek(sampleDay, "2026-09-15").notes,
    };
    const connected = reducer(s, { type: "connect", calendars: ["Work"] });
    expect(connected.week).toBe(s.week);
    expect(connected.review).toEqual(s.review);
    expect(connected.description).toBe(sampleDay);
    expect(restoreState(JSON.stringify(connected))).toEqual(connected);
  });
  it("updates only the requested days and protects planned outfits", () => {
    let s = initialState();
    const days = weekDays(s.week);
    s = reducer(s, { type: "day", day: days[1] });
    s = reducer(s, { type: "accept" });
    const planned = s.outfits[days[1]];
    const untouched = s.outfits[days[3]];
    const next = reducer(s, {
      type: "generate",
      days: [
        { day: days[0], text: "Hiking" },
        { day: days[1], text: "Dinner" },
      ],
    });
    expect(next.outfits[days[1]]).toBe(planned);
    expect(next.outfits[days[3]]).toBe(untouched);
    expect(next.outfits[days[0]].pieces).toContain("trainers");
    expect(next.notice).toContain("1 planned or worn outfit kept");
  });
  it("keeps suggested, planned and worn distinct and locks worn outfits", () => {
    let s = initialState();
    expect(reducer(s, { type: "worn" })).toBe(s);
    s = reducer(s, { type: "accept" });
    expect(s.outfits[s.day].status).toBe("planned");
    s = reducer(s, { type: "worn" });
    expect(s.outfits[s.day].status).toBe("worn");
    expect(reducer(s, { type: "swap", old: "shirt", next: "polo" })).toBe(s);
    expect(reducer(s, { type: "another" })).toBe(s);
  });
  it("allows a swap without changing plan status and rejects non-owned choices", () => {
    let s = reducer(initialState(), { type: "generate" });
    s = reducer(s, { type: "accept" });
    const old = s.outfits[s.day].pieces[0];
    s = reducer(s, {
      type: "swap",
      old,
      next: old === "shirt" ? "polo" : "shirt",
    });
    expect(s.outfits[s.day].status).toBe("planned");
    expect(reducer(s, { type: "swap", old: "polo", next: "foreign" })).toBe(s);
  });
  it("only shows event context from the selected and enabled calendars", () => {
    const s = initialState();
    expect(calendarEvent("2026-09-18", s)).toBe("Dinner · 7 PM");
    expect(calendarEvent("2026-09-19", s)).toBe("");
    expect(calendarEvent("2026-09-18", { ...s, calendars: ["Work"] })).toBe("");
    expect(calendarEvent("2026-09-18", { ...s, useCalendar: false })).toBe("");
  });
  it("validates restored records and rejects invalid dates", () => {
    expect(restoreState("bad").description).toBe("");
    const s = initialState();
    expect(reducer(s, { type: "day", day: "2026-02-31" })).toBe(s);
    expect(localDay(new Date(2026, 8, 16, 23))).toBe("2026-09-16");
    expect(
      reducer(s, { type: "connect", calendars: ["foreign"] }).connected,
    ).toBe(false);
  });
});
