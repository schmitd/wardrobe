"use client";
import { useState } from "react";
import {
  reminderInstant,
  type OutfitSuggestion,
  type CalendarWeek,
} from "@wardrobe/shared";
import { reminderRequest } from "@/lib/reminder-client";
import { Button } from "@/components/ui/button";
export default function PlanReminderTime({
  plan,
  events = [],
}: {
  plan: OutfitSuggestion;
  events?: CalendarWeek["days"][number]["events"];
}) {
  const [time, setTime] = useState("12:00"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [savedTime, setSavedTime] = useState<number | null | undefined>(
    undefined,
  );
  const displayTime =
    savedTime === undefined ? plan.reminderStartsAt : savedTime;
  if (plan.status !== "planned") return null;
  const save = async (event?: (typeof events)[number], noon = false) => {
    setBusy(true);
    setMessage("");
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      if (!event && !noon && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        throw new Error("Choose a time.");
      const startsAt = noon
        ? undefined
        : event
          ? Date.parse(event.start)
          : reminderInstant(plan.date, minute, timezone);
      await reminderRequest({
        operation: "schedule",
        planId: plan.id,
        expectedRevision: plan.planRevision ?? 0,
        timezone,
        startsAt,
        endsAt: event?.end ? Date.parse(event.end) : undefined,
        calendarId: event?.calendarId,
        eventId: event?.eventId,
      });
      setSavedTime(startsAt ?? null);
      setMessage(
        event
          ? "Linked to this event. Changes on this date will update the reminder."
          : noon
            ? "Noon reminder saved."
            : "Time saved. This time does not follow calendar changes.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this time.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-lg border border-[#ddd5e1] p-3">
      <summary className="cursor-pointer font-semibold">
        Reminder time ·{" "}
        {displayTime
          ? new Date(displayTime).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : "noon"}
      </summary>
      <p className="my-2 text-sm">
        Requires planned reminders in{" "}
        <a href="/reminders" className="underline">
          reminder settings
        </a>
        . No time means noon.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          Time{" "}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded border p-2"
          />
        </label>
        <Button variant="outline" disabled={busy} onClick={() => void save()}>
          Set time
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void save(undefined, true)}
        >
          Use noon
        </Button>
      </div>
      {events
        .filter((e) => e.eventId && e.calendarId && e.start.includes("T"))
        .map((e) => (
          <Button
            key={`${e.calendarId}:${e.eventId}`}
            variant="outline"
            className="mt-2 h-auto min-h-11 whitespace-normal text-left"
            disabled={busy}
            onClick={() => void save(e)}
          >
            Link event: {e.title}
          </Button>
        ))}
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </details>
  );
}
