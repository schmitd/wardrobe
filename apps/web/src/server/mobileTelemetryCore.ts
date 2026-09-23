const operations = new Set([
  "route",
  "record_fit",
  "add_piece",
  "try_on",
  "create_collection",
  "add_collection_item",
  "remove_collection_item",
  "save_inspiration",
  "update_bio",
  "delete_item",
  "analyze_selfie",
  "resolve_observation",
  "promote_observation",
]);

for (const operation of [
  "planning_load",
  "planning_generate",
  "planning_interpret",
  "planning_week",
  "planning_generate_week",
  "planning_accept",
  "planning_edit",
  "planning_dismiss",
  "planning_worn", "planning_not_worn", "planning_clear_response",
  "wear_list", "wear_pending",
  "wear_update",
  "calendar_list",
  "calendar_connect",
  "calendar_disconnect",
])
  operations.add(operation);
export const safeMobileOperation = (value: unknown) =>
  typeof value === "string" && operations.has(value) ? value : "unknown";

export function linkedAnalyticsSession(
  headers: Headers,
  userId: string | null,
) {
  const session = headers.get("X-POSTHOG-SESSION-ID");
  return userId &&
    headers.get("X-POSTHOG-DISTINCT-ID") === userId &&
    session &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      session,
    )
    ? session
    : undefined;
}
