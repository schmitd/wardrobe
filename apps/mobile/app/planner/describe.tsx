import { router, Stack } from "expo-router";
import { Button, Keyboard, TextInput, View } from "react-native";
import {
  outfitForDay,
  sevenDays,
  type WeekInterpretation,
} from "@wardrobe/shared";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import { PlannerDate } from "@/planner-date";
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
  const setText = (description: string) =>
    p.setDraft((s) => ({ ...s, description, review: [], clarification: "" }));
  const editable = d.review.filter(
    (day) =>
      !["planned", "worn"].includes(
        outfitForDay(p.data?.suggestions ?? [], day.date)?.status ?? "",
      ),
  );
  const interpret = async () => {
    Keyboard.dismiss();
    const result = await p.run<WeekInterpretation>({
      operation: "planning_interpret",
      description: d.description,
      week: d.week,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (result)
      p.setDraft((s) => ({
        ...s,
        review: result.days,
        clarification: result.clarification,
      }));
  };
  const generate = async () => {
    Keyboard.dismiss();
    const result = await p.run<{ updated: number; kept: number }>({
      operation: "planning_generate_week",
      days: d.review,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      useCalendar: d.useCalendar && Boolean(p.data?.calendarEnabled),
      ...(d.planId ? { planId: d.planId } : {}),
    });
    if (result) {
      p.setMessage(
        `${result.updated} days updated${result.kept ? ` · ${result.kept} planned or worn outfits kept` : ""}`,
      );
      router.back();
    }
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              title="Calendar"
              onPress={() => {
                Keyboard.dismiss();
                router.push("/planner/calendar");
              }}
            />
          ),
        }}
      />
      <PlannerPage>
        <PlannerGroup>
          <PostHogMaskView>
            <TextInput
              accessibilityLabel="Describe your week"
              multiline
              maxLength={4000}
              editable={!p.busy}
              value={d.description}
              onChangeText={setText}
              placeholder="Wednesday is a meeting. Friday is dinner. Sunday we’re hiking…"
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
        <DayVoiceInput
          disabled={p.busy}
          onText={(text) =>
            setText(
              [d.description, text].filter(Boolean).join("\n").slice(0, 4000),
            )
          }
        />
        {!d.review.length ? (
          <>
            <PlannerButton
              title={p.busy ? "Interpreting…" : "Review days"}
              disabled={p.busy || !d.description.trim()}
              onPress={() => void interpret()}
            />
            <PlannerButton
              secondary
              title="Use Calendar for this week"
              disabled={p.busy || !p.data?.calendarEnabled}
              onPress={() =>
                p.setDraft((s) => ({
                  ...s,
                  useCalendar: true,
                  review: sevenDays(s.week).map((date) => ({
                    date,
                    description: "",
                  })),
                  clarification: "",
                }))
              }
            />
          </>
        ) : (
          <>
            <PlannerText title>Review your days</PlannerText>
            <PlannerText>
              Check the dates and activities. Remove any day you do not want to
              update.
            </PlannerText>
            {d.review.map((day, index) => {
              const kept = ["planned", "worn"].includes(
                outfitForDay(p.data?.suggestions ?? [], day.date)?.status ?? "",
              );
              return (
                <PlannerGroup key={index}>
                  <View style={{ padding: 14, gap: 12 }}>
                    <PlannerDate
                      value={day.date}
                      onChange={(date) =>
                        p.setDraft((s) => ({
                          ...s,
                          review: s.review.map((row, i) =>
                            i === index ? { ...row, date } : row,
                          ),
                        }))
                      }
                    />
                    <PostHogMaskView>
                      <TextInput
                        accessibilityLabel={`Activities for ${day.date}`}
                        multiline
                        maxLength={1200}
                        editable={!p.busy}
                        value={day.description}
                        placeholder="Activities for this day"
                        placeholderTextColor={c.muted}
                        onChangeText={(description) =>
                          p.setDraft((s) => ({
                            ...s,
                            review: s.review.map((row, i) =>
                              i === index ? { ...row, description } : row,
                            ),
                          }))
                        }
                        style={{ color: c.ink, fontSize: 17, minHeight: 60 }}
                      />
                    </PostHogMaskView>
                    {kept ? (
                      <PlannerText>
                        Your planned or worn outfit will be kept.
                      </PlannerText>
                    ) : null}
                    <PlannerButton
                      secondary
                      title="Remove day"
                      disabled={p.busy}
                      onPress={() =>
                        p.setDraft((s) => ({
                          ...s,
                          review: s.review.filter((_, i) => i !== index),
                        }))
                      }
                    />
                  </View>
                </PlannerGroup>
              );
            })}
            <PlannerButton
              title={
                p.busy
                  ? "Suggesting outfits…"
                  : `Suggest outfits for ${editable.length} ${editable.length === 1 ? "day" : "days"}`
              }
              disabled={p.busy || !editable.length || Boolean(d.clarification)}
              onPress={() => void generate()}
            />
          </>
        )}
        {d.clarification ? (
          <>
            <PlannerText>{d.clarification}</PlannerText>
            <PlannerButton
              secondary
              title="I corrected the dates above"
              disabled={!d.review.length || p.busy}
              onPress={() => p.setDraft((s) => ({ ...s, clarification: "" }))}
            />
          </>
        ) : null}
        <PlannerText>
          Other days stay unchanged. Suggestions use owned pieces; review any
          missing items and the forecast.
        </PlannerText>
        {p.message ? <PlannerText>{p.message}</PlannerText> : null}
      </PlannerPage>
    </>
  );
}
