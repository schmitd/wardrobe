import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Button, Keyboard, Switch, TextInput, View } from "react-native";
import {
  localDate,
  sevenDays,
  type WeekInterpretation,
} from "@wardrobe/shared";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import { DayVoiceInput } from "@/day-voice-input";
import {
  PlannerPage,
  PlannerButton,
  PlannerGroup,
  PlannerText,
  usePlannerColors,
} from "@/planner-ui";
export default function Describe() {
  const p = usePlanner();
  const c = usePlannerColors();
  const d = p.draft;
  const { date } = useLocalSearchParams<{ date?: string }>();
  const selectedDate =
    date && sevenDays(d.week).includes(date)
      ? date
      : sevenDays(d.week).includes(localDate())
        ? localDate()
        : d.week;
  const [updating, setUpdating] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const lock = useRef(false);
  const busy = updating || p.busy;
  const setText = (description: string) =>
    p.setDraft((s) => ({ ...s, description, review: [], clarification: "" }));
  const submit = async () => {
    if (lock.current || voiceBusy) return;
    lock.current = true;
    setUpdating(true);
    Keyboard.dismiss();
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let days = d.review;
      if (d.description.trim() && !days.length) {
        const interpreted = await p.run<WeekInterpretation>({
          operation: "planning_interpret",
          description: d.description,
          week: d.week,
          anchorDate: selectedDate,
          timezone,
        });
        if (!interpreted) return;
        p.setDraft((s) => ({
          ...s,
          review: interpreted.clarification ? [] : interpreted.days,
          clarification: interpreted.clarification,
        }));
        if (interpreted.clarification) return;
        days = interpreted.days;
      }
      if (!d.description.trim())
        days = [{ date: selectedDate, description: "" }];
      const result = await p.run<{ updated: number; kept: number }>({
        operation: "planning_generate_week",
        week: d.week,
        days,
        timezone,
        useCalendar: d.useCalendar && Boolean(p.data?.calendarEnabled),
        ...(d.planId ? { planId: d.planId } : {}),
      });
      if (result) {
        p.setDraft((s) => ({ ...s, review: [], clarification: "" }));
        p.setMessage(
          `${result.updated} days updated${result.kept ? ` · ${result.kept} chosen outfits kept` : ""}`,
        );
        router.back();
      }
    } finally {
      lock.current = false;
      setUpdating(false);
    }
  };
  return (
    <>
      <Stack.Screen
        options={{
          title: "Your plans",
          headerRight: () => (
            <Button
              title="Calendar"
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                router.push("/planner/calendar");
              }}
            />
          ),
        }}
      />
      <PlannerPage>
        <DayVoiceInput
          disabled={busy}
          onBusyChange={setVoiceBusy}
          onText={(text) =>
            p.setDraft((s) => ({
              ...s,
              description: [s.description, text]
                .filter(Boolean)
                .join("\n")
                .slice(0, 4000),
              review: [],
              clarification: "",
            }))
          }
        />
        <PlannerGroup>
          <PostHogMaskView>
            <TextInput
              accessibilityLabel="Describe your day or week"
              multiline
              maxLength={4000}
              editable={!busy && !voiceBusy}
              value={d.description}
              onChangeText={setText}
              placeholder="What’s happening today or this week?"
              placeholderTextColor={c.muted}
              style={{
                color: c.ink,
                padding: 16,
                fontSize: 19,
                minHeight: 140,
                textAlignVertical: "top",
              }}
            />
          </PostHogMaskView>
        </PlannerGroup>
        {d.clarification ? (
          <PlannerText>
            {d.clarification} Edit your description, then update again.
          </PlannerText>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <PlannerText>Auto-plan next 7 days</PlannerText>
          <Switch
            accessibilityLabel="Auto-plan next 7 days"
            value={p.data?.autoPlan?.enabled ?? true}
            disabled={busy}
            onValueChange={(enabled) =>
              void p.run({
                operation: "planning_auto",
                enabled,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })
            }
          />
        </View>
        <PlannerButton
          title={
            busy
              ? "Updating outfits…"
              : d.description.trim()
                ? "Update outfits"
                : "Suggest outfit"
          }
          disabled={busy || voiceBusy || !p.data?.items.length}
          onPress={() => void submit()}
        />
        {p.message ? <PlannerText>{p.message}</PlannerText> : null}
      </PlannerPage>
    </>
  );
}
