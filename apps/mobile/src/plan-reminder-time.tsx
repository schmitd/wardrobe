import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { TextInput, View } from "react-native";
import {
  reminderInstant,
  type OutfitSuggestion,
  type CalendarWeek,
} from "@wardrobe/shared";
import { reminderRequest } from "@/api";
import { PlannerButton, PlannerText, usePlannerColors } from "@/planner-ui";
export function PlanReminderTime({
  plan,
  events,
}: {
  plan: OutfitSuggestion;
  events: CalendarWeek["days"][number]["events"];
}) {
  const { getToken } = useAuth();
  const c = usePlannerColors();
  const [expanded, setExpanded] = useState(false),
    [time, setTime] = useState("12:00"),
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
      if (!event && !noon && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        throw new Error("Enter a time such as 18:30.");
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startsAt = noon
        ? undefined
        : event
          ? Date.parse(event.start)
          : reminderInstant(
              plan.date,
              Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
              timezone,
            );
      await reminderRequest(getToken, {
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
          ? "Event linked. Changes on this date will update the reminder."
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
    <View style={{ gap: 10 }}>
      <PlannerButton
        secondary
        title={`Reminder time · ${displayTime ? new Date(displayTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "noon"}`}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <PlannerText>
            Turn on planned reminders in Account. No time means noon. Linking an
            event allows background checks of that event.
          </PlannerText>
          <TextInput
            accessibilityLabel="Reminder time, 24 hour format"
            value={time}
            onChangeText={setTime}
            placeholder="18:30"
            style={{
              padding: 14,
              borderWidth: 1,
              borderColor: c.line,
              color: c.ink,
              borderRadius: 10,
            }}
          />
          <PlannerButton
            title="Set time"
            disabled={busy}
            onPress={() => void save()}
          />
          <PlannerButton
            secondary
            title="Use noon"
            disabled={busy}
            onPress={() => void save(undefined, true)}
          />
          {events
            .filter((e) => e.calendarId && e.eventId && e.start.includes("T"))
            .map((e) => (
              <PlannerButton
                key={`${e.calendarId}:${e.eventId}`}
                secondary
                title={`Link event: ${e.title}`}
                disabled={busy}
                onPress={() => void save(e)}
              />
            ))}
          {message ? <PlannerText>{message}</PlannerText> : null}
        </>
      )}
    </View>
  );
}
