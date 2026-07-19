import {
  checkCompatibilityAction,
  createWardrobeItemAction,
  processWardrobeItemAction,
  recordDailyFitCheckAction,
  routeCaptureAction,
} from "@/app/actions/wardrobe";

export const runtime = "nodejs";

type CaptureBody = {
  operation?: "route" | "record_fit" | "add_piece" | "try_on";
  storageId?: string;
  clientFileName?: string;
  contentType?: string;
  traceId?: string;
  traceparent?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CaptureBody | null;
  if (!body?.operation || !body.storageId) {
    return Response.json({ error: "Missing capture operation or storageId." }, { status: 400 });
  }

  const trace = { traceId: body.traceId, traceparent: body.traceparent };
  try {
    switch (body.operation) {
      case "route":
        return Response.json(await routeCaptureAction({ storageId: body.storageId, ...trace }));
      case "record_fit":
        return Response.json(await recordDailyFitCheckAction({ storageId: body.storageId, ...trace }));
      case "try_on":
        return Response.json(await checkCompatibilityAction({ storageId: body.storageId, ...trace }));
      case "add_piece": {
        const created = await createWardrobeItemAction({
          storageId: body.storageId,
          clientFileName: body.clientFileName,
          contentType: body.contentType,
          ...trace,
        });
        const processed = await processWardrobeItemAction({ itemId: String(created.id), ...trace });
        if (!processed.success) throw new Error(processed.error);
        return Response.json({ id: created.id, processed: true });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed.";
    const status = message === "Unauthorized" || message === "Missing Convex token" ? 401 : 500;
    return Response.json({ error: status === 401 ? message : "Could not save this photo right now." }, { status });
  }
}
