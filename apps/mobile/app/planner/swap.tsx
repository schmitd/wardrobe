import { router, useLocalSearchParams } from "expo-router";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PieceImages,
  PlannerGroup,
  PlannerPage,
  PlannerRow,
  PlannerText,
  PlannerButton,
} from "@/planner-ui";
export default function Swap() {
  const { id, piece } = useLocalSearchParams<{ id: string; piece?: string }>();
  const p = usePlanner();
  const outfit = p.data?.suggestions.find((s) => s.id === id);
  return (
    <PlannerPage>
      <PlannerText>
        {piece ? "Replace or remove this piece." : "Add an owned piece to your outfit."}
      </PlannerText>
      {piece && outfit && outfit.itemIds.length > 1 && outfit.status !== "worn" ? <PlannerButton secondary title="Remove this piece" disabled={p.busy} onPress={() => void p.run({ operation: "planning_edit", id, itemIds: outfit.itemIds.filter(i => i !== piece) }).then(result => { if (result) router.back(); })} /> : null}
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
                      itemIds: !piece ? [...outfit.itemIds, item.id] : outfit.itemIds.map((i) =>
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
