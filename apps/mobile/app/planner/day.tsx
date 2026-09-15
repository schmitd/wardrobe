import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { outfitForDay, type PlanningOperation } from "@wardrobe/shared";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PieceImages,
  PlannerButton,
  PlannerGroup,
  PlannerPage,
  PlannerRow,
  PlannerText,
} from "@/planner-ui";
export default function Day() {
  const { date = "" } = useLocalSearchParams<{ date: string }>();
  const p = usePlanner();
  const [why, setWhy] = useState(false);
  const s = outfitForDay(p.data?.suggestions ?? [], date);
  const events = p.calendar?.days.find((d) => d.date === date)?.events ?? [];
  const update = async (operation: PlanningOperation) => {
    if (await p.run(operation)) p.setMessage("Outfit updated.");
  };
  return (
    <PlannerPage>
      <PlannerText title>
        {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </PlannerText>
      <PostHogMaskView>
        {events.map((e, i) => (
          <PlannerText key={i}>{e.title}</PlannerText>
        ))}
      </PostHogMaskView>
      {s && p.data ? (
        <>
          <PostHogMaskView>
            <PlannerText title>{s.title}</PlannerText>
          </PostHogMaskView>
          <PlannerText>
            {s.status === "planned"
              ? "Your outfit is planned."
              : s.status === "worn"
                ? "Recorded as worn."
                : "Suggested for your day"}
          </PlannerText>
          <PieceImages ids={s.itemIds} data={p.data} size={86} />
          <PlannerGroup>
            <PostHogMaskView>
              {s.itemIds.map((id) => {
                const item = p.data?.items.find((i) => i.id === id);
                return (
                  <PlannerRow
                    key={id}
                    title={item?.category ?? "Unavailable piece"}
                    subtitle={item?.description}
                    onPress={
                      s.status !== "worn"
                        ? () =>
                            router.push({
                              pathname: "/planner/swap",
                              params: { id: s.id, piece: id },
                            })
                        : undefined
                    }
                  />
                );
              })}
            </PostHogMaskView>
          </PlannerGroup>
          {s.status === "suggested" ? (
            <PlannerButton
              title="Plan this outfit"
              disabled={p.busy || !s.itemIds.length}
              onPress={() =>
                void update({ operation: "planning_accept", id: s.id })
              }
            />
          ) : s.status === "planned" ? (
            <PlannerButton
              title="I wore this"
              disabled={p.busy}
              onPress={() =>
                void update({ operation: "planning_worn", id: s.id })
              }
            />
          ) : null}
          <PlannerButton
            secondary
            title={why ? "Hide outfit details" : "Why this outfit?"}
            onPress={() => setWhy(!why)}
          />
          {why ? (
            <PostHogMaskView>
              <PlannerText>{s.rationale}</PlannerText>
              <PlannerText>{s.context.join(" · ")}</PlannerText>
            </PostHogMaskView>
          ) : null}
          {s.missing.length ? (
            <PostHogMaskView>
              <PlannerText>
                To complete or adapt: {s.missing.join(" · ")}
              </PlannerText>
            </PostHogMaskView>
          ) : null}
          {s.status !== "worn" ? (
            <PlannerButton
              secondary
              title="Dismiss outfit"
              disabled={p.busy}
              onPress={() =>
                Alert.alert(
                  "Why dismiss?",
                  "Your other outfits will stay unchanged.",
                  [
                    { text: "Cancel", style: "cancel" },
                    ...[
                      "Not my style",
                      "Wrong for the occasion",
                      "Pieces unavailable",
                    ].map((reason) => ({
                      text: reason,
                      onPress: () =>
                        void update({
                          operation: "planning_dismiss",
                          id: s.id,
                          reason,
                        }),
                    })),
                  ],
                )
              }
            />
          ) : null}
        </>
      ) : (
        <>
          <PlannerText>
            No outfit suggested yet. Describe this day or include your calendar
            events.
          </PlannerText>
          <PlannerButton
            title="Suggest an outfit"
            onPress={() => {
              p.setDraft((d) => ({
                ...d,
                review: [{ date, description: "" }],
                clarification: "",
              }));
              router.push("/planner/describe");
            }}
          />
        </>
      )}
      {p.message ? <PlannerText>{p.message}</PlannerText> : null}
    </PlannerPage>
  );
}
