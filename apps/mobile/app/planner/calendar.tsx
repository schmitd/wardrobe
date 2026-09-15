import { useState } from "react";
import { Alert, Switch } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PlannerButton,
  PlannerGroup,
  PlannerPage,
  PlannerRow,
  PlannerText,
} from "@/planner-ui";
export default function Calendar() {
  const p = usePlanner();
  const [calendars, setCalendars] = useState<
    { id: string; name: string; primary: boolean }[]
  >([]);
  const [selected, setSelected] = useState(p.data?.calendarIds ?? []);
  const [opening, setOpening] = useState(false);
  const load = async () => {
    const result = await p.run<{
      calendars: typeof calendars;
      truncated: boolean;
    }>({ operation: "calendar_list" });
    if (result) {
      setCalendars(result.calendars);
      setSelected(
        p.data?.calendarIds.length
          ? p.data.calendarIds
          : result.calendars.filter((c) => c.primary).map((c) => c.id),
      );
      if (result.truncated) p.setMessage("Showing the first 100 calendars.");
    }
  };
  const connect = async () => {
    setOpening(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${process.env.EXPO_PUBLIC_WARDROBE_API_URL || "https://wardrobe.davidcschmitt.com"}/fits?view=plans&calendar=connect&returnTo=mobile`,
        "wardrobe://fits",
      );
      if (result.type !== "success") return;
      await p.refresh();
      await load();
    } catch {
      p.setMessage(
        "Calendar did not connect. Your week and draft are still here.",
      );
    } finally {
      setOpening(false);
    }
  };
  return (
    <PlannerPage>
      <PlannerText title>
        {p.data?.calendarEnabled
          ? "Your Google calendars"
          : "An outfit that fits your plans."}
      </PlannerText>
      <PlannerText>
        Read-only access to calendars you choose. Wardrobe never adds or changes
        events. Your week and dictation draft stay here while you connect.
      </PlannerText>
      {!calendars.length ? (
        <>
          <PlannerButton
            title={
              opening
                ? "Connecting…"
                : p.data?.calendarEnabled
                  ? "Reconnect Google"
                  : "Continue with Google"
            }
            disabled={opening || p.busy}
            onPress={() => void connect()}
          />
          <PlannerButton
            secondary
            title="Choose calendars"
            disabled={p.busy || opening}
            onPress={() => void load()}
          />
        </>
      ) : (
        <>
          <PlannerGroup>
            <PostHogMaskView>
              {calendars.map((calendar) => (
                <PlannerRow
                  key={calendar.id}
                  title={calendar.name}
                  trailing={
                    <Switch
                      accessibilityLabel={`Use ${calendar.name}`}
                      value={selected.includes(calendar.id)}
                      onValueChange={(enabled) =>
                        setSelected((ids) =>
                          enabled
                            ? [...ids, calendar.id].slice(0, 10)
                            : ids.filter((id) => id !== calendar.id),
                        )
                      }
                    />
                  }
                />
              ))}
            </PostHogMaskView>
          </PlannerGroup>
          <PlannerButton
            title="Use selected calendars"
            disabled={!selected.length || p.busy}
            onPress={() =>
              void p
                .run({ operation: "calendar_connect", calendarIds: selected })
                .then((result) => {
                  if (result) {
                    p.setDraft((d) => ({ ...d, useCalendar: true }));
                    router.back();
                  }
                })
            }
          />
        </>
      )}
      <PlannerText>
        When you open a week, event titles and times are read for display.
        Requested outfit generation also uses locations. These details never go
        to product analytics. Disconnecting deletes calendar-derived outfits,
        including planned and worn entries.
      </PlannerText>
      {p.data?.calendarEnabled ? (
        <PlannerButton
          secondary
          title="Disconnect Calendar"
          disabled={p.busy}
          onPress={() =>
            Alert.alert(
              "Disconnect and delete derived outfits?",
              "Calendar-derived recommendations, including planned and worn entries, will be deleted. Other wardrobe data and Google sign-in stay intact.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Disconnect and delete",
                  style: "destructive",
                  onPress: () =>
                    void p
                      .run({ operation: "calendar_disconnect" })
                      .then((result) => {
                        if (result) {
                          setCalendars([]);
                          router.back();
                        }
                      }),
                },
              ],
            )
          }
        />
      ) : null}
      {p.message ? <PlannerText>{p.message}</PlannerText> : null}
    </PlannerPage>
  );
}
