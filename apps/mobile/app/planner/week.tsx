import { router } from "expo-router";
import { useState } from "react";
import { usePlanner } from "@/planner-context";
import { PlannerDate } from "@/planner-date";
import { PlannerPage, PlannerButton, PlannerText } from "@/planner-ui";
export default function Week() {
  const p = usePlanner();
  const [date, setDate] = useState(p.draft.week);
  return (
    <PlannerPage>
      <PlannerText>Choose the first day of your seven-day view.</PlannerText>
      <PlannerDate value={date} onChange={setDate} inline />
      <PlannerButton
        title="Show this week"
        onPress={() => {
          p.setDraft((d) => ({
            ...d,
            week: date,
            review: [],
            clarification: "",
          }));
          router.back();
        }}
      />
    </PlannerPage>
  );
}
