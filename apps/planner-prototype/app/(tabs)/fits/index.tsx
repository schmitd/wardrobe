import { useState } from "react";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router, Stack } from "expo-router";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { addDays, calendarEvent, weekDays } from "../../../src/model";
import { usePlanner } from "../../../src/store";
import { Caption, Group, Primary, Symbol, usePalette } from "../../../src/ui";
import { OutfitStrip } from "../../../src/garment-image";
export default function Fits() {
  const { state, dispatch } = usePlanner();
  const c = usePalette();
  const [mode, setMode] = useState(1);
  const { fontScale } = useWindowDimensions();
  const week = weekDays(state.week);
  const label = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const shownDays =
    mode === 1
      ? week
      : Object.keys(state.outfits).filter(
          (d) => state.outfits[d].status === "worn",
        );
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}
      >
        <SegmentedControl
          values={["Diary", "Plans"]}
          selectedIndex={mode}
          onChange={(e) => setMode(e.nativeEvent.selectedSegmentIndex)}
        />
        {mode === 1 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              onPress={() =>
                dispatch({ type: "week", week: addDays(state.week, -7) })
              }
              style={{ padding: 12 }}
            >
              <Symbol name="chevron.left" size={17} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose week"
              onPress={() => router.push("/week")}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}>
                {label(state.week)} – {label(week[6])}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next week"
              onPress={() =>
                dispatch({ type: "week", week: addDays(state.week, 7) })
              }
              style={{ padding: 12 }}
            >
              <Symbol name="chevron.right" size={17} />
            </Pressable>
          </View>
        ) : (
          <Caption>
            Your worn outfits appear here. Planning an outfit does not mark it
            worn.
          </Caption>
        )}
        <Group>
          {shownDays.map((day, i) => {
            const date = new Date(`${day}T12:00:00`);
            const outfit = state.outfits[day];
            const event = calendarEvent(day, state);
            const note = state.notes[day];
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${note || event || "Free day"}, ${outfit?.status ?? "No suggestion"}`}
                onPress={() => {
                  dispatch({ type: "day", day });
                  router.push("/outfit");
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  minHeight: 70,
                  borderBottomWidth: i === shownDays.length - 1 ? 0 : 0.5,
                  borderColor: c.line,
                })}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                >
                  <View style={{ width: 41 * fontScale }}>
                    <Text style={{ color: c.ink, fontSize: 14 }}>
                      {date.toLocaleDateString(undefined, { weekday: "short" })}
                    </Text>
                    <Text
                      style={{
                        color: c.ink,
                        fontSize: 20,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      {note || event ? (
                        <Symbol
                          name={note ? "mic" : "calendar"}
                          size={13}
                          color={c.muted}
                        />
                      ) : null}
                      <Text
                        style={{ color: c.ink, fontSize: 14, flex: 1 }}
                        numberOfLines={fontScale > 1.3 ? undefined : 2}
                      >
                        {note || event || "Free day"}
                      </Text>
                    </View>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      {outfit
                        ? outfit.status === "planned"
                          ? "Planned"
                          : outfit.status === "worn"
                            ? "Worn"
                            : "Suggested"
                        : "Suggest an outfit"}
                    </Text>
                  </View>
                  {outfit && fontScale < 1.5 ? (
                    <OutfitStrip pieces={outfit.pieces} size={34} />
                  ) : null}
                  <Symbol name="chevron.right" size={12} color={c.muted} />
                </View>
                {outfit && fontScale >= 1.5 ? (
                  <View style={{ paddingTop: 8, paddingLeft: 54 }}>
                    <OutfitStrip pieces={outfit.pieces} size={50} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Group>
        {mode === 1 ? (
          <Primary
            title="Describe your week"
            onPress={() => router.push("/dictate")}
          />
        ) : null}
        {state.notice ? (
          <Text
            accessibilityLiveRegion="polite"
            selectable
            style={{ color: c.muted, textAlign: "center", fontSize: 13 }}
          >
            {state.notice}
          </Text>
        ) : null}
        <Text style={{ color: c.muted, fontSize: 11, textAlign: "center" }}>
          Design preview · sample wardrobe and events
        </Text>
      </ScrollView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Google Calendar"
                onPress={() => router.push("/calendar")}
                style={{ padding: 11 }}
              >
                <Symbol name="calendar.badge.plus" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Planner options"
                onPress={() => router.push("/options")}
                style={{ padding: 11 }}
              >
                <Symbol name="ellipsis" />
              </Pressable>
            </View>
          ),
        }}
      />
    </>
  );
}
