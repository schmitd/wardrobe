import posthog from "posthog-js";
import type { PlanningOperation } from "@wardrobe/shared";

export async function planningRequest<T>(body: PlanningOperation): Promise<T> {
  const started = Date.now();
  const response = await fetch("/api/planning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
