import { getMobileBootstrapAction } from "@/app/actions/wardrobe";

export const runtime = "nodejs";

export async function GET() {
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
