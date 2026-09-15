import { router, useLocalSearchParams } from "expo-router";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PieceImages,
  PlannerGroup,
  PlannerPage,
  PlannerRow,
  PlannerText,
} from "@/planner-ui";
export default function Swap() {
  const { id, piece } = useLocalSearchParams<{ id: string; piece: string }>();
  const p = usePlanner();
  const outfit = p.data?.suggestions.find((s) => s.id === id);
  return (
    <PlannerPage>
      <PlannerText>
        Choose an owned replacement. The rest of your outfit stays the same.
      </PlannerText>
      <PlannerGroup>
        <PostHogMaskView>
          {p.data?.items
            .filter((i) => !outfit?.itemIds.includes(i.id) || i.id === piece)
            .map((item) => (
              <PlannerRow
                key={item.id}
                title={item.category}
                subtitle={item.description}
                trailing={<PieceImages ids={[item.id]} data={p.data!} />}
                onPress={() => {
                  if (!outfit || p.busy || outfit.status === "worn") return;
                  void p
                    .run({
                      operation: "planning_edit",
                      id,
                      itemIds: outfit.itemIds.map((i) =>
                        i === piece ? item.id : i,
                      ),
                    })
                    .then((result) => {
                      if (result) router.back();
                    });
                }}
              />
            ))}
        </PostHogMaskView>
      </PlannerGroup>
      {p.message ? <PlannerText>{p.message}</PlannerText> : null}
    </PlannerPage>
  );
}
