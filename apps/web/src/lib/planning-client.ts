import posthog from "posthog-js";
import type { PlanningOperation } from "@wardrobe/shared";
import { createTraceContext } from "./trace";

export async function planningRequest<T>(body: PlanningOperation): Promise<T> {
  const started = Date.now();
  const trace = createTraceContext();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Wardrobe-Trace-ID": trace.traceId,
  };
  if (!posthog.has_opted_out_capturing()) {
    const distinctId = posthog.get_distinct_id();
    const sessionId = posthog.get_session_id();
    if (distinctId && sessionId) {
      headers["X-POSTHOG-DISTINCT-ID"] = distinctId;
      headers["X-POSTHOG-SESSION-ID"] = sessionId;
    }
  }
  const response = await fetch("/api/planning", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, ...("id" in body ? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}) }),
  });
  const result = await response.json();
  // Deliberate bounded dimensions only, no date, IDs, text, calendar names or errors.
  if (!posthog.has_opted_out_capturing())
    posthog.capture("planning_operation_finished", {
      operation: body.operation,
      outcome: response.ok ? "success" : "failure",
      duration_ms: Date.now() - started,
      source: "web",
      analytics_schema: 1,
    });
  if (!response.ok)
    throw new Error(result.error ?? "Could not update this outfit.");
  return result;
}
