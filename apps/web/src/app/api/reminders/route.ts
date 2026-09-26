import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ReminderOperation } from "@wardrobe/shared";
import { getConvexAuth } from "@/server/auth";
import { limitedJson } from "@/server/limitedJson";
import { publicServerFailure, RequestFailure } from "@/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Open Wardrobe to continue." },
      { status: 403 },
    );
  try {
    const { token } = await getConvexAuth(),
      options = { token };
    const input = (await limitedJson(request, 12_000)) as ReminderOperation;
    if (!input || typeof input !== "object")
      throw new RequestFailure({
        status: 400,
        message: "Invalid reminder request.",
      });
    const { operation, ...args } = input;
    // Convex validators reject extra fields and validate every relationship against the session owner.
    let result: unknown;
    switch (operation) {
      case "settings":
        result = await fetchQuery(api.reminders.settings, {}, options);
        break;
      case "preferences":
        result = await fetchMutation(
          api.reminders.preferences,
          args as Extract<ReminderOperation, { operation: "preferences" }> & {
            primaryInstallationId?: Id<"notificationInstallations">;
          },
          options,
        );
        break;
      case "register":
        result = await fetchMutation(
          api.reminders.register,
          args as Extract<ReminderOperation, { operation: "register" }>,
          options,
        );
        break;
      case "revoke":
        result = await fetchMutation(
          api.reminders.revoke,
          args as { installationId: string },
          options,
        );
        break;
      case "capture":
        result = await fetchMutation(
          api.reminders.capture,
          args as { active: boolean; planId?: Id<"outfitSuggestions"> },
          options,
        );
        break;
      case "schedule":
        result = await fetchMutation(
          api.reminders.schedule,
          args as Extract<ReminderOperation, { operation: "schedule" }> & {
            planId: Id<"outfitSuggestions">;
          },
          options,
        );
        break;
      case "open":
        result = await fetchQuery(
          api.reminders.open,
          args as { id: Id<"notificationIntents"> },
          options,
        );
        break;
      default:
        throw new RequestFailure({
          status: 400,
          message: "Unknown reminder request.",
        });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = publicServerFailure(
      error,
      "Could not update reminders. Please try again.",
    );
    return Response.json(
      { error: failure.message },
      { status: failure.status },
    );
  }
}
