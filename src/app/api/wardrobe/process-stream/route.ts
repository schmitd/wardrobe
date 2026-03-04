import { auth } from "@clerk/nextjs/server";
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
  const { userId, getToken } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken({
    template: process.env.CLERK_JWT_TEMPLATE ?? "convex",
  });
  if (!token) {
    return Response.json({ error: "Missing Convex token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) {
    return Response.json({ error: "Missing itemId" }, { status: 400 });
  }

  const { traceId, traceparent } = ensureTraceContext({
    traceId: body?.traceId,
    traceparent: body?.traceparent,
  });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: StreamEvent) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  const stream = new ReadableStream({
    start: async (controller) => {
      try {
        const result = await processWardrobeInference({
          itemId,
          userId,
          token,
          traceId,
          traceparent,
          onProgress: (stage) => send(controller, { type: "status", stage }),
          onTags: ({ category, styleTags }) =>
            send(controller, { type: "tags", category, styleTags }),
          onDescription: ({ category, description }) =>
            send(controller, { type: "description", category, description }),
        });

        if (!result.success) {
          send(controller, { type: "error", error: result.error });
        } else {
          send(controller, { type: "complete" });
        }
      } catch {
        send(controller, {
          type: "error",
          error: "Failed to process this item right now. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
