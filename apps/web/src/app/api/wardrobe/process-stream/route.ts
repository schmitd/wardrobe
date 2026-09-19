import { progressStream } from "@/server/progressStream";
import { limitedJson } from "@/server/limitedJson";
import { getConvexAuth, enforceAuthenticatedProtection } from "@/server/auth";
import { publicServerFailure } from "@/server/errors";
import { ensureTraceContext } from "@/lib/trace";
import { processWardrobeInference } from "@/server/wardrobeInference";

export const runtime = "nodejs";

type StreamEvent =
  | { type: "status"; stage: string }
  | { type: "tags"; category: string | null; styleTags: string[] }
  | { type: "description"; category: string | null; description: string }
  | { type: "complete" }
  | { type: "error"; error: string };

export async function POST(request: Request) {
  let session;
  try {
    session = await getConvexAuth();
    await enforceAuthenticatedProtection({ ...session, scope: "inference" });
  } catch (error) {
    const failure = publicServerFailure(error);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
  const { userId, token } = session;

  let body: Record<string, unknown>;
  try { body = await limitedJson(request, 4000) as Record<string, unknown>; }
  catch (error) { const failure = publicServerFailure(error); return Response.json({ error: failure.message }, { status: failure.status }); }
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) {
    return Response.json({ error: "Missing itemId" }, { status: 400 });
  }

  const { traceId, traceparent } = ensureTraceContext({
    traceId: typeof body?.traceId === "string" ? body.traceId : undefined,
    traceparent: typeof body?.traceparent === "string" ? body.traceparent : undefined,
  });

  const stream = progressStream<StreamEvent>(request.signal, async send => {
      try {
        const result = await processWardrobeInference({
          itemId,
          userId,
          token,
          traceId,
          traceparent,
          onProgress: (stage) => send( { type: "status", stage }),
          onTags: ({ category, styleTags }) =>
            send( { type: "tags", category, styleTags }),
          onDescription: ({ category, description }) =>
            send( { type: "description", category, description }),
        });

        if (!result.success) {
          send( { type: "error", error: result.error });
        } else {
          send( { type: "complete" });
        }
      } catch {
        send( {
          type: "error",
          error: "Failed to process this item right now. Please try again.",
        });
      }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
