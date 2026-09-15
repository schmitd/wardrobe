import {
  localDate,
  validatePlanningDate,
  type OutfitSuggestion,
} from "./planning";

export type ReviewedDay = { date: string; description: string };
export type WeekInterpretation = { days: ReviewedDay[]; clarification: string };
export type CalendarWeek = {
  days: {
    date: string;
    events: { title: string; start: string }[];
    truncated: boolean;
  }[];
};
export function shiftDay(day: string, count: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + count);
  return localDate(date);
}
export const sevenDays = (start: string) =>
  Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
export function outfitForDay(suggestions: OutfitSuggestion[], date: string) {
  const matching = suggestions.filter(
    (s) => s.date === date && s.status !== "dismissed",
  );
  return (
    matching.find((s) => s.status === "worn") ??
    matching.find((s) => s.status === "planned") ??
    matching[0]
  );
}
export function validateReviewedDays(
  value: unknown,
  timezone: string,
  now = new Date(),
): ReviewedDay[] {
  if (!Array.isArray(value) || !value.length || value.length > 7)
    throw Error("Choose 1–7 days.");
  const dates = new Set<string>();
  return value.map((row) => {
    if (!row || typeof row !== "object") throw Error("Review each day first.");
    const date = validatePlanningDate(row.date, timezone, now).date;
    if (dates.has(date))
      throw Error("Combine activities for the same date before continuing.");
    dates.add(date);
    if (typeof row.description !== "string" || row.description.length > 1200)
      throw Error("Keep each day under 1,200 characters.");
    return { date, description: row.description.trim() };
  });
}
export function validateWeekInterpretation(
  value: unknown,
  week: string,
  timezone: string,
  now = new Date(),
): WeekInterpretation {
  const data = value as WeekInterpretation | null;
  if (
    !data ||
    !Array.isArray(data.days) ||
    typeof data.clarification !== "string" ||
    data.clarification.length > 400
  )
    throw Error("Could not interpret these days. Please try again.");
  const days = data.days.length
    ? validateReviewedDays(data.days, timezone, now)
    : [];
  if (days.some((d) => !sevenDays(week).includes(d.date)))
    throw Error(
      "The description includes dates outside this week. Choose that week first.",
    );
  if (!days.length && !data.clarification)
    throw Error("Describe at least one day.");
  return { days, clarification: data.clarification };
}
