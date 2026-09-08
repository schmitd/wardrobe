// Deliberate allowlist: never forward forms, route params, images, or errors.
const values: Record<string, readonly string[]> = {
  method: ["email_code", "password", "google"],
  stage: ["send_code", "verify_code", "password", "google", "upload", "route", "commit", "render", "camera", "picker"],
  intent: ["my_wardrobe", "just_trying"],
  scope: ["single_piece", "full_fit"],
  source: ["camera", "library"],
  outcome: ["success", "failure", "cancelled"],
  permission: ["granted", "denied", "undetermined"],
  operation: ["bootstrap", "upload_url", "route", "record_fit", "add_piece", "try_on", "create_collection", "add_collection_item", "remove_collection_item", "save_inspiration", "update_bio", "delete_item", "analyze_selfie", "resolve_observation", "promote_observation"],
};

export function safeProperties(input: Record<string, unknown> = {}) {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (values[key]?.includes(value as string)) output[key] = value as string;
    if (["duration_ms", "attempt", "status", "confidence"].includes(key) && typeof value === "number" && Number.isFinite(value)) output[key] = Math.max(0, Math.min(value, 3_600_000));
    if (["onboarding", "needs_review", "can_ask_again"].includes(key) && typeof value === "boolean") output[key] = value;
    if (key === "trace_id" && typeof value === "string" && /^[a-f0-9]{32}$/.test(value) && !/^0+$/.test(value)) output[key] = value;
  }
  return output;
}

export function screenName(segments: readonly string[]) {
  // Expo segments retain [id] placeholders, unlike pathname and search params.
  const route = segments.filter((part) => !part.startsWith("(")).join("/");
  const allowed = ["", "index", "sign-in", "wardrobe", "rack", "fits", "collections", "profile", "account", "capture-entry", "capture/index", "capture/processing", "item/[id]", "plan/new", "plan/[id]", "collection/new", "collection/[id]"];
  return allowed.includes(route) ? route || "index" : "other";
}
