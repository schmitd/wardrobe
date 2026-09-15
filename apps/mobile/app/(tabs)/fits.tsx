import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { GarmentObservationReview } from "@/garment-observation-review";
import { ErrorPanel, Loading, Page, Panel } from "@/screen";
import { colors } from "@/theme";
import { useWardrobe } from "@/use-wardrobe";
import { DayPlanner } from "@/day-planner";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import {
  isIOS,
  usePlannerColors,
  PieceImages,
  PlannerGroup,
  PlannerRow,
} from "@/planner-ui";
import { usePlanner } from "@/planner-context";
import { PostHogMaskView } from "posthog-react-native";

type FitsView = "diary" | "plans";

const keyFor = (value: Date | number) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function ViewPicker({
  value,
  onChange,
}: {
  value: FitsView;
  onChange: (value: FitsView) => void;
}) {
  const c = usePlannerColors();
  if (isIOS)
    return (
      <SegmentedControl
        values={["Diary", "Plans"]}
        selectedIndex={value === "diary" ? 0 : 1}
        onChange={(event) =>
          onChange(
            event.nativeEvent.selectedSegmentIndex === 0 ? "diary" : "plans",
          )
        }
      />
    );
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: c.line,
        backgroundColor: c.bg,
      }}
    >
      {(["diary", "plans"] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            android_ripple={{ color: c.line }}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: selected ? 3 : 0,
              borderColor: c.accent,
            }}
          >
            <Text
              style={{
                color: selected ? c.accent : c.muted,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              {option === "diary" ? "Diary" : "Plans"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Fits() {
  const params = useLocalSearchParams<{ view?: string }>();
  const router = useRouter();
  const [view, setView] = useState<FitsView>(
    params.view === "plans" ? "plans" : "diary",
  );
  const query = useWardrobe();
  const planner = usePlanner();
  const worn = (planner.data?.suggestions ?? [])
    .filter((s) => s.status === "worn")
    .sort((a, b) => b.date.localeCompare(a.date));
  const daily = (query.data?.fitChecks ?? []).filter(
    (fit) => fit.type === "daily_fit_check",
  );
  const byDay = new Map<string, (typeof daily)[number]>();
  for (const fit of daily) {
    const key = keyFor(fit.createdAt);
    if (!byDay.has(key)) byDay.set(key, fit);
  }
  const days = Array.from({ length: 84 }, (_, index) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (83 - index));
    return day;
  });
  const recentFitCount = days.reduce(
    (count, day) => count + Number(byDay.has(keyFor(day))),
    0,
  );

  useEffect(() => {
    if (params.view === "plans") setView("plans");
  }, [params.view]);

  return (
    <Page refresh={() => void query.refetch()} refreshing={query.isRefetching}>
      {view === "diary" ? (
        <View style={{ gap: 7 }}>
          <Text
            selectable
            style={{
              color: colors.plum,
              fontSize: 13,
              fontWeight: "900",
              textTransform: "uppercase",
            }}
          >
            {view === "diary" ? "Outfit memory" : "Outfit planning"}
          </Text>
          <Text
            selectable
            style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}
          >
            {view === "diary"
              ? "Remember what you wore and see your wardrobe take shape over time."
              : "Bring owned pieces and inspiration together around a trip, occasion, or idea."}
          </Text>
        </View>
      ) : null}
      <ViewPicker
        value={view}
        onChange={(nextView) => {
          setView(nextView);
          router.setParams({ view: nextView });
        }}
      />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && view === "diary" ? (
        <>
          {worn.length && planner.data ? (
            <PlannerGroup>
              <Text
                style={{
                  padding: 16,
                  color: colors.ink,
                  fontSize: 20,
                  fontWeight: "600",
                }}
              >
                Outfits you wore
              </Text>
              <PostHogMaskView>
                {worn.map((s) => (
                  <PlannerRow
                    key={s.id}
                    title={s.title}
                    subtitle={`${s.date} · Worn`}
                    trailing={
                      <PieceImages
                        ids={s.itemIds}
                        data={planner.data!}
                        size={30}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/planner/day",
                        params: { date: s.date },
                      })
                    }
                  />
                ))}
              </PostHogMaskView>
            </PlannerGroup>
          ) : null}
          <Panel>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <View>
                <Text
                  selectable
                  style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}
                >
                  Your recent rhythm
                </Text>
                <Text selectable style={{ color: colors.muted, marginTop: 3 }}>
                  Last 12 weeks
                </Text>
              </View>
              <Text
                selectable
                style={{ color: colors.plum, fontWeight: "800" }}
              >
                {recentFitCount} fits
              </Text>
            </View>
            <View
              accessibilityLabel="Daily fit calendar"
              style={{
                marginTop: 8,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              {days.map((day) => {
                const fit = byDay.get(keyFor(day));
                return (
                  <View
                    key={keyFor(day)}
                    accessibilityLabel={`${day.toLocaleDateString()}: ${fit ? "fit recorded" : "no fit"}`}
                    style={{
                      width: "7.4%",
                      aspectRatio: 1,
                      borderColor: fit ? colors.line : colors.washStrong,
                      borderWidth: 1,
                      backgroundColor: fit ? colors.lime : colors.paper,
                    }}
                  >
                    {fit?.imageUrl ? (
                      <Image
                        source={fit.imageUrl}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Panel>
          <View style={{ gap: 14 }}>
            <Text
              selectable
              style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}
            >
              Recent fits
            </Text>
            {(query.data?.fitChecks ?? []).length === 0 ? (
              <Panel tint={colors.wash}>
                <Text
                  selectable
                  style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}
                >
                  Your diary starts with a fit.
                </Text>
                <Text
                  selectable
                  style={{ color: colors.muted, lineHeight: 20 }}
                >
                  Use Capture to remember what you wore or try something on.
                </Text>
              </Panel>
            ) : null}
            {(query.data?.fitChecks ?? []).map((fit) => (
              <View
                key={fit.id}
                style={{
                  borderColor: colors.line,
                  borderWidth: 1,
                  backgroundColor: colors.surface,
                  overflow: "hidden",
                  borderRadius: 14,
                  borderCurve: "continuous",
                }}
              >
                {fit.imageUrl ? (
                  <Image
                    source={fit.imageUrl}
                    style={{
                      width: "100%",
                      aspectRatio: 1.15,
                      backgroundColor: colors.wash,
                    }}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ padding: 14, gap: 8 }}>
                  <Text
                    selectable
                    style={{
                      color: colors.plum,
                      fontWeight: "900",
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {fit.type === "try_on" ? "Try on" : "Fit check"} ·{" "}
                    {new Date(fit.createdAt).toLocaleDateString()}
                  </Text>
                  <Text
                    selectable
                    style={{ color: colors.ink, lineHeight: 20 }}
                  >
                    {fit.transcription ??
                      fit.description ??
                      "This fit is still being read."}
                  </Text>
                  {fit.items.length > 0 ? (
                    <Text
                      selectable
                      style={{ color: colors.muted, fontSize: 12 }}
                    >
                      {fit.items.length} piece
                      {fit.items.length === 1 ? "" : "s"} detected
                    </Text>
                  ) : null}
                  {fit.type === "daily_fit_check" ? (
                    <GarmentObservationReview observations={fit.observations} />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {!query.isLoading && !query.error && view === "plans" ? (
        <View style={{ gap: 14 }}>
          <DayPlanner />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text
              selectable
              style={{
                flex: 1,
                color: colors.ink,
                fontSize: 20,
                fontWeight: "900",
              }}
            >
              Your plans
            </Text>
            <Link href="/plan/new" asChild>
              <Pressable
                accessibilityLabel="Create plan"
                style={{
                  minHeight: 42,
                  paddingHorizontal: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.lime,
                  borderColor: colors.line,
                  borderWidth: 1,
                  borderRadius: 10,
                  borderCurve: "continuous",
                }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color={colors.ink}
                />
                <Text style={{ color: colors.ink, fontWeight: "900" }}>
                  New
                </Text>
              </Pressable>
            </Link>
          </View>
          {query.data?.wardrobes.length === 0 ? (
            <Panel tint={colors.wash}>
              <MaterialCommunityIcons
                name="cards-outline"
                size={30}
                color={colors.plum}
              />
              <Text
                selectable
                style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}
              >
                Make your first plan
              </Text>
              <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
                Start with a trip, an occasion, or a feeling. Add references and
                owned pieces as it takes shape.
              </Text>
              <Link href="/plan/new" asChild>
                <Pressable
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: colors.lime,
                    borderColor: colors.line,
                    borderWidth: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: colors.ink, fontWeight: "900" }}>
                    Create a plan
                  </Text>
                </Pressable>
              </Link>
            </Panel>
          ) : null}
          {query.data?.wardrobes.map((plan) => (
            <Link
              key={plan._id}
              href={{ pathname: "/plan/[id]", params: { id: plan._id } }}
              asChild
            >
              <Pressable
                style={({ pressed }) => ({
                  borderColor: colors.line,
                  borderWidth: 1,
                  backgroundColor: pressed ? colors.wash : colors.surface,
                  padding: 17,
                  gap: 9,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  boxShadow: "2px 3px 0 rgba(67,40,63,.15)",
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontSize: 21,
                      fontWeight: "900",
                    }}
                  >
                    {plan.name}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={25}
                    color={colors.plum}
                  />
                </View>
                {plan.description ? (
                  <Text
                    selectable
                    style={{ color: colors.muted, lineHeight: 21 }}
                  >
                    {plan.description}
                  </Text>
                ) : null}
                <Text
                  selectable
                  style={{
                    color: colors.plum,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {plan.items.length} owned · {plan.inspirations.length}{" "}
                  inspiration
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
