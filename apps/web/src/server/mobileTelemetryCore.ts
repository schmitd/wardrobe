const operations = new Set(["route", "record_fit", "add_piece", "try_on", "create_collection", "add_collection_item", "remove_collection_item", "save_inspiration", "update_bio", "delete_item", "analyze_selfie", "resolve_observation", "promote_observation"]);

export const safeMobileOperation = (value: unknown) => typeof value === "string" && operations.has(value) ? value : "unknown";

export function linkedAnalyticsSession(headers: Headers, userId: string | null) {
  const session = headers.get("X-POSTHOG-SESSION-ID");
  return userId && headers.get("X-POSTHOG-DISTINCT-ID") === userId && session && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(session) ? session : undefined;
}
