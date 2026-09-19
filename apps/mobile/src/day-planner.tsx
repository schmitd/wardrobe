import { router } from "expo-router";
import { Text, View, Pressable, useWindowDimensions } from "react-native";
import { localDate, outfitForDay, sevenDays, shiftDay } from "@wardrobe/shared";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PieceImages,
  PlannerButton,
  PlannerGroup,
  PlannerText,
  usePlannerColors,
} from "@/planner-ui";
export function DayPlanner() {
  const p = usePlanner();
  const c = usePlannerColors();
  const { fontScale } = useWindowDimensions();
  const label = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const changeWeek = (week: string) =>
    p.setDraft((d) => ({ ...d, week, review: [], clarification: "" }));
  return (
    <View
      style={{ gap: 12, backgroundColor: c.bg, padding: 4, borderRadius: 16 }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          disabled={p.draft.week <= shiftDay(localDate(), -360)}
          onPress={() =>
            changeWeek(shiftDay(p.draft.week, -7))
          }
          style={{
            padding: 14,
            opacity: p.draft.week <= shiftDay(localDate(), -360) ? 0.3 : 1,
          }}
        >
          <Text style={{ color: c.accent, fontSize: 23 }}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose week"
          onPress={() => router.push("/planner/week")}
          style={{ paddingVertical: 14, flex: 1 }}
        >
          <Text
            style={{
              color: c.ink,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {label(p.draft.week)} – {label(shiftDay(p.draft.week, 6))}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          disabled={shiftDay(p.draft.week, 7) > shiftDay(localDate(), 360)}
          onPress={() => changeWeek(shiftDay(p.draft.week, 7))}
          style={{ padding: 14 }}
        >
          <Text style={{ color: c.accent, fontSize: 23 }}>›</Text>
        </Pressable>
      </View>
      {p.loading ? (
        <PlannerText>Loading your outfits…</PlannerText>
      ) : p.error ? (
        <PlannerButton
          title="Retry loading outfits"
          secondary
          onPress={() => void p.refresh()}
        />
      ) : (
        <PlannerGroup>
          {sevenDays(p.draft.week).map((date) => {
            const outfit = outfitForDay(p.data?.suggestions ?? [], date);
            const calendarDay = p.calendar?.days.find((d) => d.date === date);
            const events = calendarDay?.events ?? [];
            const day = new Date(`${date}T12:00:00`);
            const context = (calendarDay?.truncated ? "Partial calendar · " : "") + (
              events
                .map((e) => e.title)
                .slice(0, 2)
                .join(" · ") ||
              outfit?.title ||
              "No plans yet");
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${outfit?.status ?? "No suggestion"}`}
                android_ripple={{ color: c.line }}
                onPress={() =>
                  router.push({ pathname: "/planner/day", params: { date } })
                }
                style={{
                  padding: 12,
                  borderBottomWidth: 0.5,
                  borderColor: c.line,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <View style={{ width: 38 * fontScale }}>
                    <Text style={{ color: c.ink, fontSize: 13 }}>
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </Text>
                    <Text style={{ color: c.ink, fontSize: 21 }}>
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <PostHogMaskView>
                      <Text
                        numberOfLines={fontScale > 1.3 ? undefined : 2}
                        style={{ color: c.ink, fontSize: 15 }}
                      >
                        {events.length ? "▦ " : ""}
                        {context}
                      </Text>
                    </PostHogMaskView>
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        textTransform: "capitalize",
                      }}
                    >
                      {outfit?.status ?? "Suggest an outfit"}
                    </Text>
                  </View>
                  {outfit && p.data && fontScale < 1.5 ? (
                    <PieceImages ids={outfit.itemIds} data={p.data} size={30} />
                  ) : null}
                  <Text style={{ color: c.muted }}>›</Text>
                </View>
                {outfit && p.data && fontScale >= 1.5 ? (
                  <PieceImages ids={outfit.itemIds} data={p.data} size={46} />
                ) : null}
              </Pressable>
            );
          })}
        </PlannerGroup>
      )}
      <PlannerButton
        title="Describe your week"
        disabled={p.loading || !p.data}
        onPress={() => router.push("/planner/describe")}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/planner/calendar")}
          style={{ padding: 12 }}
        >
          <Text style={{ color: c.accent }}>
            {p.data?.calendarEnabled
              ? "Calendar connected"
              : "Connect Calendar"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/planner/options")}
          style={{ padding: 12 }}
        >
          <Text style={{ color: c.accent }}>More options</Text>
        </Pressable>
      </View>
      {p.calendarError ? (
        <PlannerText>
          Calendar could not refresh. Your outfits are still here; reconnect in
          Calendar or continue with dictation.
        </PlannerText>
      ) : null}
      {p.message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: c.accent }}>
          {p.message}
        </Text>
      ) : null}
    </View>
  );
}
