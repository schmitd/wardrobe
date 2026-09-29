import { shiftDay } from "@wardrobe/shared";

// Calendar dates are interpreted in the user's timezone, including DST and all-day events.
export function zonedMidnight(date: string, timezone: string) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let value = target;
  for (let pass = 0; pass < 3; pass++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(value);
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    value += target - represented;
  }
  return new Date(value).toISOString();
}

export function dateInZone(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function nextPlanningRun(timezone: string, now = new Date()) {
  // Fill the newly arriving seventh day just after local midnight, including DST.
  return (
    Date.parse(
      zonedMidnight(shiftDay(dateInZone(timezone, now), 1), timezone),
    ) + 60000
  );
}
