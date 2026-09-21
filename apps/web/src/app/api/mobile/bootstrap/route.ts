import { publicServerFailure } from "@/server/errors";
import { getConvexAuth } from "@/server/auth";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getMobileBootstrapAction } from "@/app/actions/wardrobe";
import { observeMobileRequest } from "@/server/mobileTelemetry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return observeMobileRequest(request, "bootstrap", handleBootstrap);
}

async function handleBootstrap(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("v") === "2") {
      const { token } = await getConvexAuth();
      return Response.json(await fetchQuery(api.mobile.bootstrap, {}, { token }));
    }
    return Response.json(await getMobileBootstrapAction());
  } catch (error) {
    const failure = publicServerFailure(error, "Could not load Wardrobe.");
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
