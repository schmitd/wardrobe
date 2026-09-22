import { runInference } from "@/lib/run-effect";
import { publicServerFailure } from "@/server/errors";
import { Effect } from "effect";
import { fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getConvexAuth } from "@/server/auth";
import { InferenceService } from "@/services/InferenceService";
import { observeMobileRequest } from "@/server/mobileTelemetry";
import { limitedJson } from "@/server/limitedJson";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return observeMobileRequest(request, "transcribe", async (request) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json(
        { error: "Open Wardrobe to continue." },
        { status: 403 },
      );
    try {
      const { token } = await getConvexAuth();
      if (Number(request.headers.get("content-length")) > 3000000)
        return Response.json(
          { error: "Record a shorter note (maximum 60 seconds)." },
          { status: 413 },
        );
      const body = (await limitedJson(request, 3000000)) as {
        mimeType: string;
        audio: string;
        confirmed: boolean;
      };
      if (
        !["audio/mp4", "audio/webm", "audio/ogg", "audio/wav"].includes(
          body.mimeType,
        ) ||
        typeof body.audio !== "string" ||
        !body.audio.length ||
        !/^[a-zA-Z0-9+/]+={0,2}$/.test(body.audio) ||
        body.confirmed !== true
      )
        return Response.json(
          { error: "Confirm the recording before transcribing." },
          { status: 400 },
        );
      await fetchMutation(api.planning.reserveGeneration, { transcription: true }, { token });
      // In-memory audio only. No storage uploads, prompt logs, or Zep writes.
      const text = await runInference(
        InferenceService.pipe(
          Effect.flatMap(inference => inference.transcribe({ data: body.audio, mimeType: body.mimeType })),
          Effect.timeout("50 seconds"),
        ),
      );
      return Response.json(
        { text },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const failure = publicServerFailure(error, "Could not transcribe that recording. Please type your day or try a shorter note.");
      return Response.json(
        {
          error: failure.message,
        },
        { status: failure.status },
      );
    }
  });
}
