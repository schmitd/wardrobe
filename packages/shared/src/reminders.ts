export type ReminderKind =
  | "daily_fit_due"
  | "planned_fit_due"
  | "untimed_plan_fit_due";
export const REMINDER_POLICY_VERSION = 1;
export type ReminderPreferences = {
  daily: boolean;
  planned: boolean;
  timezone: string;
  middayMinute: number;
  quietStart: number;
  quietEnd: number;
  dailyCap: number;
};
export const defaultReminders = (timezone: string): ReminderPreferences => ({
  daily: false,
  planned: false,
  timezone,
  middayMinute: 720,
  quietStart: 1260,
  quietEnd: 540,
  dailyCap: 2,
});
export function zonedClock(instant: number, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
export function reminderInstant(
  date: string,
  minute: number,
  timezone: string,
) {
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const instant = target + delta * 3_600_000;
    const local = zonedClock(instant, timezone);
    offsets.add(
      Date.parse(`${local.date}T00:00:00Z`) + local.minute * 60_000 - instant,
    );
  }
  const matches = [...offsets]
    .map((offset) => target - offset)
    .filter((instant) => {
      const local = zonedClock(instant, timezone);
      return local.date === date && local.minute === minute;
    });
  if (matches.length) return Math.min(...matches); // First repeated local minute.
  let chosen: { minute: number; instant: number } | undefined;
  for (
    let instant = target - 18 * 3_600_000;
    instant <= target + 18 * 3_600_000;
    instant += 60_000
  ) {
    const local = zonedClock(instant, timezone);
    if (
      local.date === date &&
      local.minute >= minute &&
      (!chosen || local.minute < chosen.minute)
    )
      chosen = { minute: local.minute, instant };
  }
  if (!chosen)
    throw new Error("This local day does not exist in the selected timezone.");
  return chosen.instant;
}
export function validateReminderPreferences(p: ReminderPreferences) {
  if (
    typeof p.daily !== "boolean" ||
    typeof p.planned !== "boolean" ||
    p.timezone.length > 100
  )
    throw new Error("Invalid reminder preferences.");
  zonedClock(Date.now(), p.timezone);
  if (
    [p.middayMinute, p.quietStart, p.quietEnd].some(
      (value) => !Number.isInteger(value) || value < 0 || value >= 1440,
    ) ||
    ![1, 2].includes(p.dailyCap)
  )
    throw new Error("Choose valid reminder times and a cap of one or two.");
}
export type ReminderDecision =
  | { action: "send" }
  | { action: "defer"; until: number; reason: "capture_active" }
  | { action: "suppress"; reason: string };
export function evaluateReminder(input: {
  now: number;
  dueAt: number;
  expiresAt: number;
  kind: ReminderKind;
  preferences: ReminderPreferences;
  deviceReady: boolean;
  currentRevision: boolean;
  factsKnown: boolean;
  hasAcceptedPlan: boolean;
  hasDailyWear: boolean;
  hasCorrespondingEvidence: boolean;
  explicitlyNotWorn: boolean;
  calendarFresh: boolean;
  captureUntil?: number;
  usedToday: number;
  lastReservedAt?: number;
  lastDailyAt?: number;
}): ReminderDecision {
  const p = input.preferences;
  const no = (reason: string): ReminderDecision => ({
    action: "suppress",
    reason,
  });
  if (!(input.kind === "daily_fit_due" ? p.daily : p.planned))
    return no("opted_out");
  if (!input.currentRevision) return no("superseded");
  if (!input.factsKnown) return no("facts_unknown");
  if (!input.deviceReady) return no("device_unavailable");
  if (input.now < input.dueAt || input.now >= input.expiresAt)
    return no("outside_window");
  if (!input.calendarFresh) return no("calendar_stale");
  if (input.explicitlyNotWorn || input.hasCorrespondingEvidence)
    return no("occurrence_resolved");
  if (
    input.kind === "daily_fit_due" &&
    (input.hasAcceptedPlan || input.hasDailyWear)
  )
    return no("day_has_plan_or_wear");
  const minute = zonedClock(input.now, p.timezone).minute;
  const quiet =
    p.quietStart === p.quietEnd
      ? false
      : p.quietStart < p.quietEnd
        ? minute >= p.quietStart && minute < p.quietEnd
        : minute >= p.quietStart || minute < p.quietEnd;
  if (quiet) return no("quiet_hours");
  if (input.usedToday >= p.dailyCap) return no("daily_cap");
  if (
    input.lastReservedAt !== undefined &&
    input.now - input.lastReservedAt < 3 * 3_600_000
  )
    return no("cooldown");
  if (
    input.kind === "daily_fit_due" &&
    input.lastDailyAt !== undefined &&
    input.now - input.lastDailyAt < 20 * 3_600_000
  )
    return no("travel_daily_guard");
  if (input.captureUntil && input.captureUntil > input.now)
    return input.now + 600_000 < input.expiresAt
      ? {
          action: "defer",
          until: Math.min(input.captureUntil, input.now + 600_000),
          reason: "capture_active",
        }
      : no("capture_active");
  return { action: "send" };
}

export type ReminderSettings = {
  preferences: ReminderPreferences | null;
  primaryInstallationId?: string;
  installations: { id: string; label: string; transport: "expo" | "web" }[];
  live: boolean;
  webPublicKey: string | null;
};
export type ReminderOpen = {
  planId?: string;
  planRevision?: number;
  date: string;
  resolved: boolean;
  expired: boolean;
} | null;
export type ReminderOperation =
  | { operation: "settings" }
  | ({
      operation: "preferences";
      primaryInstallationId?: string;
    } & ReminderPreferences)
  | {
      operation: "register";
      installationId: string;
      transport: "expo" | "web";
      endpoint: string;
      p256dh?: string;
      auth?: string;
      label: string;
      timezone: string;
      select: boolean;
    }
  | { operation: "revoke"; installationId: string }
  | { operation: "capture"; active: boolean; planId?: string }
  | {
      operation: "schedule";
      planId: string;
      expectedRevision: number;
      timezone: string;
      startsAt?: number;
      endsAt?: number;
      calendarId?: string;
      eventId?: string;
    }
  | { operation: "open"; id: string };
