import { expect, test } from "bun:test";
import { zonedMidnight } from "./planning";

test("Google day boundaries follow DST instead of a fixed 24-hour window", () => {
  const start = zonedMidnight("2026-03-08", "America/New_York");
  const end = zonedMidnight("2026-03-09", "America/New_York");
  expect(start).toBe("2026-03-08T05:00:00.000Z");
  expect(end).toBe("2026-03-09T04:00:00.000Z");
  expect(Date.parse(end) - Date.parse(start)).toBe(23 * 3600000);
  expect(zonedMidnight("2026-09-13", "Pacific/Auckland")).toBe("2026-09-12T12:00:00.000Z");
});
