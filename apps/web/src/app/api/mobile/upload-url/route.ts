import { getUploadUrlAction } from "@/app/actions/wardrobe";

export const runtime = "nodejs";

export async function POST() {
  try {
    return Response.json({ uploadUrl: await getUploadUrlAction() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare upload.";
    return Response.json(
      { error: message === "Unauthorized" ? message : "Could not prepare upload." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
