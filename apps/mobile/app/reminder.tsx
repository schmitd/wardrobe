import { useAuth } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { ReminderOpen } from "@wardrobe/shared";
import { reminderRequest } from "@/api";
import { PlannerPage, PlannerText, PlannerButton } from "@/planner-ui";
export default function ReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [value, setValue] = useState<ReminderOpen>(null),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void reminderRequest<ReminderOpen>(getToken, { operation: "open", id })
      .then((value) => {
        if (active) setValue(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [getToken, id]);
  return (
    <PlannerPage>
      <PlannerText>
        {!loaded
          ? "Checking this reminder…"
          : !value
            ? "This reminder is no longer available for this account."
            : value.resolved
              ? "This outfit has already been recorded or reviewed."
              : value.expired
                ? "This reminder has passed. You can still review the outfit in your diary."
                : `Ready to record your fit for ${value.date}?`}
      </PlannerText>
      {value && !value.resolved && !value.expired && (
        <PlannerButton
          title="Record this fit"
          onPress={() =>
            router.replace({
              pathname: "/capture",
              params: {
                planId: value.planId,
                planRevision: value.planRevision?.toString(),
              },
            })
          }
        />
      )}
      {value?.planId && (
        <PlannerButton
          secondary
          title="Review the current plan"
          onPress={() =>
            router.replace({
              pathname: "/planner/day",
              params: { date: value.date },
            })
          }
        />
      )}
      <PlannerButton
        secondary
        title="Open fit diary"
        onPress={() => router.replace("/(tabs)/fits")}
      />
    </PlannerPage>
  );
}
