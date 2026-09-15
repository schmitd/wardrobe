import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  localDate,
  type CalendarWeek,
  type PlanningData,
  type PlanningOperation,
  type ReviewedDay,
} from "@wardrobe/shared";
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { planningRequest } from "@/api";
import { useSegments, useGlobalSearchParams } from "expo-router";

export type PlannerDraft = {
  week: string;
  description: string;
  review: ReviewedDay[];
  clarification: string;
  useCalendar: boolean;
  planId: string;
};
const initial = (): PlannerDraft => ({
  week: localDate(),
  description: "",
  review: [],
  clarification: "",
  useCalendar: true,
  planId: "",
});
function useController() {
  const { getToken, userId, isSignedIn } = useAuth();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ view?: string }>();
  const plannerVisible =
    segments.some((s) => s === "planner") ||
    (segments.some((s) => s === "fits") && params.view === "plans");
  const client = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["day-planning", userId],
    queryFn: () =>
      planningRequest<PlanningData>(getToken, { operation: "planning_load" }),
    enabled: Boolean(isSignedIn),
  });
  const calendar = useQuery({
    queryKey: [
      "planning-week",
      userId,
      draft.week,
      query.data?.calendarEnabled,
      query.data?.calendarIds,
    ],
    queryFn: () =>
      planningRequest<CalendarWeek>(getToken, {
        operation: "planning_week",
        week: draft.week,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    enabled: Boolean(
      plannerVisible && restored && isSignedIn && query.data?.calendarEnabled,
    ),
    staleTime: 120000,
    retry: 1,
  });
  useEffect(() => {
    let active = true;
    if (!userId) {
      setRestored(true);
      return;
    }
    void SecureStore.getItemAsync(`planner-draft-${userId}`)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        if (
          saved.expires > Date.now() &&
          saved.draft?.week >= localDate() &&
          /^\d{4}-\d{2}-\d{2}$/.test(saved.draft.week) &&
          typeof saved.draft.description === "string" &&
          Array.isArray(saved.draft.review)
        )
          setDraft({ ...initial(), ...saved.draft });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRestored(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    if (userId && restored)
      void SecureStore.setItemAsync(
        `planner-draft-${userId}`,
        JSON.stringify({ draft, expires: Date.now() + 8 * 3600000 }),
      ).catch(() => {});
  }, [userId, draft, restored]);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["day-planning", userId] });
    await client.invalidateQueries({ queryKey: ["planning-week", userId] });
  };
  const run = async <T,>(operation: PlanningOperation): Promise<T | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await planningRequest<T>(getToken, operation);
      if (
        operation.operation !== "planning_interpret" &&
        operation.operation !== "calendar_list"
      )
        await refresh();
      return result;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not complete this request.",
      );
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return {
    draft,
    setDraft,
    busy,
    message,
    setMessage,
    data: query.data,
    loading: query.isLoading || !restored,
    error: query.error,
    calendar: calendar.data,
    calendarError: calendar.error,
    refresh,
    run,
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const controller = useController();
  return <Context value={controller}>{children}</Context>;
}
export function usePlanner() {
  const value = use(Context);
  if (!value) throw Error("Planner unavailable");
  return value;
}
