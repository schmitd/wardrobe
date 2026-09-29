import { createClerkClient } from "@clerk/backend";
import { Context, Effect, Layer } from "effect";
import { CALENDAR_SCOPES } from "@wardrobe/shared";
import { zonedMidnight } from "../lib/planning-time";
import { RequestFailure } from "../server/errors";
export class CalendarFailure extends RequestFailure {
  readonly calendar = true;
  constructor(message: string, status: RequestFailure["status"] = 409) {
    super({ message, status });
  }
}
async function googleToken(userId: string) {
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const result = await client.users.getUserOauthAccessToken(userId, "google");
  const account = result.data.find((a) =>
    CALENDAR_SCOPES.every((scope) => a.scopes?.includes(scope)),
  );
  if (!account)
    throw new CalendarFailure(
      "Connect Google Calendar and allow both read-only permissions first.",
      409,
    );
  return account.token;
}

async function google<T>(
  token: string,
  path: string,
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/${path}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    },
  );
  if (!response.ok)
    throw new CalendarFailure(
      response.status === 403
        ? "Google Calendar access is unavailable. Reconnect and allow calendar access; the Calendar API must be enabled for Wardrobe."
        : "Google Calendar could not be read. Reconnect or turn calendar context off.",
      409,
    );
  return response.json();
}

async function listCalendars(userId: string, signal: AbortSignal) {
  const token = await googleToken(userId);
  const result = await google<{
    items?: { id: string; summary?: string; primary?: boolean }[];
    nextPageToken?: string;
  }>(
    token,
    "users/me/calendarList",
    new URLSearchParams({
      maxResults: "100",
      minAccessRole: "reader",
      fields: "items(id,summary,primary),nextPageToken",
    }),
    signal,
  );
  return {
    calendars: (result.items ?? []).map((c) => ({
      id: c.id,
      name: (c.summary ?? "Calendar").slice(0, 200),
      primary: c.primary ?? false,
    })),
    truncated: Boolean(result.nextPageToken),
  };
}

async function calendarDay(
  userId: string,
  calendarIds: readonly string[],
  date: string,
  timezone: string,
  includeDetails = true,
  signal: AbortSignal,
) {
  const token = await googleToken(userId);
  const tomorrow = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  const responses = await Promise.all(
    calendarIds.map((id) =>
      google<{
        items?: {
          summary?: string;
          location?: string;
          start?: { date?: string; dateTime?: string };
          end?: { date?: string; dateTime?: string };
          status?: string;
        }[];
        nextPageToken?: string;
      }>(
        token,
        `calendars/${encodeURIComponent(id)}/events`,
        new URLSearchParams({
          timeMin: zonedMidnight(date, timezone),
          timeMax: zonedMidnight(tomorrow, timezone),
          timeZone: timezone,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "50",
          showDeleted: "false",
          fields: includeDetails
            ? "items(summary,location,start,end,status),nextPageToken"
            : "items(summary,start,status),nextPageToken",
        }),
        signal,
      ),
    ),
  );
  return {
    events: responses
      .flatMap((r) =>
        (r.items ?? [])
          .filter((e) => e.status !== "cancelled")
          .map((e) => ({
            title: (e.summary ?? "Busy").slice(0, 200),
            ...(includeDetails
              ? {
                  location: (e.location ?? "").slice(0, 200),
                  end: e.end?.dateTime ?? e.end?.date ?? "",
                }
              : {}),
            start: e.start?.dateTime ?? e.start?.date ?? "",
          })),
      )
      .slice(0, 100),
    truncated:
      responses.some((r) => Boolean(r.nextPageToken)) ||
      responses.reduce((n, r) => n + (r.items?.length ?? 0), 0) > 100,
  };
}

const failure = (error: unknown) =>
  error instanceof CalendarFailure
    ? error
    : new CalendarFailure(
        "Google Calendar could not be read. Reconnect or turn calendar context off.",
      );
export interface PlanningCalendar {
  readonly list: (
    userId: string,
  ) => Effect.Effect<
    Awaited<ReturnType<typeof listCalendars>>,
    CalendarFailure
  >;
  readonly day: (
    userId: string,
    calendarIds: readonly string[],
    date: string,
    timezone: string,
    includeDetails?: boolean,
  ) => Effect.Effect<Awaited<ReturnType<typeof calendarDay>>, CalendarFailure>;
}
export const PlanningCalendar =
  Context.Service<PlanningCalendar>("PlanningCalendar");
export const PlanningCalendarLive = Layer.succeed(PlanningCalendar, {
  list: (userId) =>
    Effect.tryPromise({
      try: (signal) => listCalendars(userId, signal),
      catch: failure,
    }).pipe(Effect.timeout("20 seconds"), Effect.mapError(failure)),
  day: (userId, ids, date, timezone, details = true) =>
    Effect.tryPromise({
      try: (signal) =>
        calendarDay(userId, ids, date, timezone, details, signal),
      catch: failure,
    }).pipe(Effect.timeout("20 seconds"), Effect.mapError(failure)),
});
