import { limitedJson } from "@/server/limitedJson";
import { RequestFailure } from "@/server/errors";
import {
  checkCompatibilityAction,
  createWardrobeItemAction,
  processWardrobeItemAction,
  recordDailyFitCheckAction,
  routeCaptureAction,
} from "@/app/actions/wardrobe";
import { Effect, Schema } from "effect";
import { observeMobileRequest } from "@/server/mobileTelemetry";

import {
  MobileCaptureFailure,
  publicCaptureError,
  toMobileCaptureFailure,
} from "@/server/mobileCaptureError";

export const runtime = "nodejs";
export const maxDuration = 180;

const CaptureBody = Schema.Struct({
  operation: Schema.Literals(["route", "record_fit", "add_piece", "try_on"]),
  storageId: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(100)),
  scope: Schema.optionalKey(Schema.Literals(["single_piece", "full_fit"])),
  clientFileName: Schema.optionalKey(Schema.String), contentType: Schema.optionalKey(Schema.String),
});
type CompleteCaptureBody = typeof CaptureBody.Type;

export async function POST(request: Request) {
  return observeMobileRequest(request, "capture", handleCapture);
}

async function handleCapture(request: Request, traceId: string) {
  const parseBody = Effect.tryPromise({
    try: () => limitedJson(request, 40000), catch: toMobileCaptureFailure,
  }).pipe(Effect.flatMap(body => Schema.decodeUnknownEffect(CaptureBody)(body).pipe(
    Effect.mapError(() => toMobileCaptureFailure(new RequestFailure({ status: 400, message: "Choose a capture operation and photo." }))),
  )));

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
            return checkCompatibilityAction({ storageId: body.storageId, scope: body.scope, ...trace });
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
          const response = publicCaptureError(failure);
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
