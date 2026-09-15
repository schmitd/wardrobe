import { Switch } from "react-native";
import { PostHogMaskView } from "posthog-react-native";
import { usePlanner } from "@/planner-context";
import {
  PlannerGroup,
  PlannerPage,
  PlannerRow,
  PlannerText,
} from "@/planner-ui";
export default function Options() {
  const p = usePlanner();
  return (
    <PlannerPage>
      <PlannerText title>Optional context</PlannerText>
      <PlannerGroup>
        <PlannerRow
          title="Use Google Calendar"
          trailing={
            <Switch
              accessibilityLabel="Use Google Calendar for suggestions"
              disabled={!p.data?.calendarEnabled}
              value={p.draft.useCalendar && Boolean(p.data?.calendarEnabled)}
              onValueChange={(useCalendar) =>
                p.setDraft((d) => ({ ...d, useCalendar }))
              }
            />
          }
        />
      </PlannerGroup>
      <PlannerText>Anchor your outfits to a saved Plan, if useful.</PlannerText>
      <PlannerGroup>
        <PostHogMaskView>
          {[{ id: "", name: "No Plan" }, ...(p.data?.plans ?? [])].map(
            (plan) => (
              <PlannerRow
                key={plan.id}
                title={plan.name}
                subtitle={p.draft.planId === plan.id ? "Selected" : undefined}
                onPress={() => p.setDraft((d) => ({ ...d, planId: plan.id }))}
              />
            ),
          )}
        </PostHogMaskView>
      </PlannerGroup>
    </PlannerPage>
  );
}
