import { getMobileBootstrapAction } from "@/app/actions/wardrobe";
import { observeMobileRequest } from "@/server/mobileTelemetry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return observeMobileRequest(request, "bootstrap", handleBootstrap);
}

async function handleBootstrap() {
  try {
    return Response.json(await getMobileBootstrapAction());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Wardrobe.";
    return Response.json(
      { error: message === "Unauthorized" ? message : "Could not load Wardrobe." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
