import {
  checkCompatibilityAction,
  createWardrobeItemAction,
  processWardrobeItemAction,
  recordDailyFitCheckAction,
  routeCaptureAction,
} from "@/app/actions/wardrobe";
import { Effect } from "effect";
import { observeMobileRequest } from "@/server/mobileTelemetry";

import {
  MobileCaptureFailure,
  publicCaptureError,
  toMobileCaptureFailure,
} from "@/server/mobileCaptureError";

export const runtime = "nodejs";

type CaptureBody = {
  operation?: "route" | "record_fit" | "add_piece" | "try_on";
  storageId?: string;
  clientFileName?: string;
  contentType?: string;
  traceId?: string;
  traceparent?: string;
};

type CompleteCaptureBody = CaptureBody & {
  operation: NonNullable<CaptureBody["operation"]>;
  storageId: string;
};

export async function POST(request: Request) {
  return observeMobileRequest(request, "capture", handleCapture);
}

async function handleCapture(request: Request, traceId: string) {
  const parseBody = Effect.tryPromise({
    try: () => request.json() as Promise<CaptureBody>,
    catch: (cause) => toMobileCaptureFailure(cause),
  }).pipe(
    Effect.flatMap((body) =>
      body?.operation && body.storageId
        ? Effect.succeed(body as CompleteCaptureBody)
        : Effect.fail(new MobileCaptureFailure({
            cause: "invalid_request",
            message: "Missing capture operation or storageId.",
          }))
    )
  );

  const execute = (body: CompleteCaptureBody) =>
    Effect.tryPromise({
      try: async () => {
        const trace = { traceId };
        switch (body.operation) {
          case "route":
            return routeCaptureAction({ storageId: body.storageId, ...trace });
          case "record_fit":
            return recordDailyFitCheckAction({ storageId: body.storageId, ...trace });
          case "try_on":
            return checkCompatibilityAction({ storageId: body.storageId, ...trace });
          case "add_piece": {
            const created = await createWardrobeItemAction({
              storageId: body.storageId,
              clientFileName: body.clientFileName,
              contentType: body.contentType,
              ...trace,
            });
            if (!created.created && created.analysisStatus === "ready") {
              return { id: created.id, processed: true, reused: true };
            }
            const processed = await processWardrobeItemAction({ itemId: String(created.id), ...trace });
            if (!processed.success) throw new Error(processed.error);
            return { id: created.id, processed: true };
          }
        }
      },
      catch: (cause) => {
        const failure = toMobileCaptureFailure(cause);
        return new MobileCaptureFailure({
          cause: failure.cause,
          message: failure.message,
          operation: body.operation,
          traceId,
        });
      },
    });

  return Effect.runPromise(
    parseBody.pipe(
      Effect.flatMap(execute),
      Effect.match({
        onFailure: (failure) => {
          const response = failure.message === "Missing capture operation or storageId."
            ? { status: 400, message: failure.message }
            : publicCaptureError(failure);
          console.error("mobile.capture.failed", {
            operation: failure.operation,
            traceId: failure.traceId,
            status: response.status,
          });
          return Response.json({ error: response.message }, { status: response.status });
        },
        onSuccess: (result) => Response.json(result),
      })
    )
  );
}
