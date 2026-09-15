export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export type OutfitStatus = "suggested" | "planned" | "worn" | "dismissed";
export type PlanningItem = {
  id: string;
  description: string;
  category: string;
  imageUrl: string | null;
};
export type OutfitSuggestion = {
  id: string;
  date: string;
  title: string;
  rationale: string;
  context: string[];
  itemIds: string[];
  missing: string[];
  status: OutfitStatus;
  calendarDerived: boolean;
};
export type PlanningData = {
  items: PlanningItem[];
  plans: { id: string; name: string; description: string }[];
  suggestions: OutfitSuggestion[];
  calendarEnabled: boolean;
  calendarIds: string[];
};
export type PlanningOperation =
  | { operation: "planning_load" }
  | {
      operation: "planning_interpret";
      week: string;
      timezone: string;
      description: string;
    }
  | { operation: "planning_week"; week: string; timezone: string }
  | {
      operation: "planning_generate_week";
      days: { date: string; description: string }[];
      timezone: string;
      useCalendar: boolean;
      planId?: string;
    }
  | {
      operation: "planning_generate";
      date: string;
      timezone: string;
      description: string;
      planId?: string;
      useCalendar: boolean;
    }
  | {
      operation:
        | "planning_accept"
        | "planning_worn"
        | "planning_dismiss"
        | "planning_edit";
      id: string;
      itemIds?: string[];
      reason?: string;
    }
  | { operation: "calendar_list" }
  | { operation: "calendar_connect"; calendarIds: string[] }
  | { operation: "calendar_disconnect" };

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validatePlanningDate(
  value: unknown,
  timezone: unknown,
  now = new Date(),
) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Choose a date in YYYY-MM-DD format.");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Choose a valid date.");
  if (typeof timezone !== "string" || timezone.length > 100)
    throw new Error("Choose a valid timezone.");
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    throw new Error("Choose a valid timezone.");
  }
  const days =
    (parsed.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000;
  if (days < 0 || days > 366)
    throw new Error("Choose today or a date within the next year.");
  return { date: value, nearTerm: days < 14 };
}

// Model output is untrusted: an invented or foreign item must never be saved.
export function validateOutfit(value: unknown, ownedIds: Set<string>) {
  const data = value as Record<string, unknown> | null;
  const text = (key: string, limit: number) => {
    const entry = data?.[key];
    if (typeof entry !== "string" || !entry.trim() || entry.length > limit)
      throw new Error("Invalid recommendation.");
    return entry.trim();
  };
  const list = (key: string, max: number, length: number) => {
    const entry = data?.[key];
    if (
      !Array.isArray(entry) ||
      entry.length > max ||
      entry.some((item) => typeof item !== "string" || item.length > length)
    )
      throw new Error("Invalid recommendation.");
    return entry as string[];
  };
  const itemIds = [...new Set(list("itemIds", 12, 100))];
  if (itemIds.some((id) => !ownedIds.has(id)))
    throw new Error(
      "Recommendation contained an unavailable piece. Please try again.",
    );
  const missing = list("missing", 8, 300);
  if (!itemIds.length && !missing.length)
    throw new Error("Recommendation has no pieces or explanation.");
  return {
    title: text("title", 160),
    rationale: text("rationale", 2400),
    itemIds,
    missing,
  };
}
