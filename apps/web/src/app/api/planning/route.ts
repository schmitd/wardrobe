import { executePlanning, PlanningError } from "@/server/planning";
import { observeMobileRequest } from "@/server/mobileTelemetry";
import type { PlanningOperation } from "@wardrobe/shared";
import { limitedJson } from "@/server/limitedJson";

export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  return observeMobileRequest(request, "planning", async (request) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json(
        { error: "Open Wardrobe to continue." },
        { status: 403 },
      );
    try {
      if (Number(request.headers.get("content-length")) > 16000)
        throw new PlanningError("The request is too large.", 413);
      const body = (await limitedJson(request, 16000)) as PlanningOperation;
      if (!body || typeof body !== "object")
        throw new PlanningError("Invalid request.");
      return Response.json(await executePlanning(body), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof PlanningError)
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      const unauthorized =
        error instanceof Error &&
        ["Unauthorized", "Missing Convex token"].includes(error.message);
      // Provider/Convex errors can contain user context. Do not log or return them.
      return Response.json(
        {
          error: unauthorized
            ? "Sign in to continue."
            : "Could not complete this request. Check your date and selected pieces, then try again.",
        },
        { status: unauthorized ? 401 : 400 },
      );
    }
  });
}
