import { getUploadUrlAction } from "@/app/actions/wardrobe";
import { observeMobileRequest } from "@/server/mobileTelemetry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return observeMobileRequest(request, "upload_url", handleUpload);
}

async function handleUpload() {
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
