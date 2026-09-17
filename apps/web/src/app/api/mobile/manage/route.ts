import { publicServerFailure, RequestFailure } from "@/server/errors";
import { limitedJson } from "@/server/limitedJson";
import { Effect, Schema } from "effect";
import { observeMobileRequest } from "@/server/mobileTelemetry";

import {
  addCollectionItemAction,
  analyzeSelfieAction,
  createCollectionAction,
  deleteWardrobeItemAction,
  promoteFitObservationAction,
  removeCollectionItemAction,
  resolveFitObservationAction,
  saveInspirationAction,
  updateProfileBioAction,
} from "@/app/actions/wardrobe";

export const runtime = "nodejs";

const ManageBody = Schema.Struct({
  operation: Schema.Literals(["create_collection", "add_collection_item", "remove_collection_item", "save_inspiration", "update_bio", "delete_item", "analyze_selfie", "resolve_observation", "promote_observation"]),
  wardrobeId: Schema.optionalKey(Schema.String), itemId: Schema.optionalKey(Schema.String), observationId: Schema.optionalKey(Schema.String), storageId: Schema.optionalKey(Schema.String), name: Schema.optionalKey(Schema.String), description: Schema.optionalKey(Schema.String), bio: Schema.optionalKey(Schema.String), reason: Schema.optionalKey(Schema.String), traceId: Schema.optionalKey(Schema.String), traceparent: Schema.optionalKey(Schema.String),
});
type ManageBody = typeof ManageBody.Type;

const required = (value: string | undefined, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestFailure({ status: 400, message: `Missing ${label}.` });
  return value.trim();
};

const execute = async (body: ManageBody): Promise<unknown> => {
  const trace = { traceId: body.traceId, traceparent: body.traceparent };
  switch (body.operation) {
    case "create_collection":
      return await createCollectionAction({ name: required(body.name, "name"), ...(body.description ? { description: body.description } : {}), ...trace });
    case "add_collection_item":
      return await addCollectionItemAction({ wardrobeId: required(body.wardrobeId, "collection"), itemId: required(body.itemId, "item"), ...trace });
    case "remove_collection_item":
      return await removeCollectionItemAction({ wardrobeId: required(body.wardrobeId, "collection"), itemId: required(body.itemId, "item") });
    case "save_inspiration":
      return await saveInspirationAction({ wardrobeId: required(body.wardrobeId, "collection"), storageId: required(body.storageId, "photo"), ...trace });
    case "update_bio":
      return await updateProfileBioAction({ bio: body.bio ?? "", ...trace });
    case "delete_item":
      return await deleteWardrobeItemAction({ itemId: required(body.itemId, "item"), reason: body.reason?.trim() || "Other", ...trace });
    case "analyze_selfie":
      return await analyzeSelfieAction({ storageId: required(body.storageId, "photo"), ...trace });
    case "resolve_observation":
      return await resolveFitObservationAction({ observationId: required(body.observationId, "observation"), wardrobeItemId: required(body.itemId, "item") });
    case "promote_observation":
      return await promoteFitObservationAction({ observationId: required(body.observationId, "observation") });
    default:
      throw new RequestFailure({ status: 400, message: "Unknown mobile operation." });
  }
};

export async function POST(request: Request) {
  return observeMobileRequest(request, "manage", handleManage);
}

async function handleManage(request: Request, traceId: string) {
  const body = await Effect.runPromise(
    Effect.tryPromise({
      try: () => limitedJson(request, 40000),
      catch: cause => cause instanceof RequestFailure ? cause : new RequestFailure({ status: 400, message: "The request body could not be read." }),
    }).pipe(Effect.flatMap(value => Schema.decodeUnknownEffect(ManageBody)(value).pipe(Effect.mapError(() => new RequestFailure({ status: 400, message: "Invalid mobile request." })))), Effect.result)
  );
  if (body._tag === "Failure") return Response.json({ error: body.failure.message }, { status: body.failure.status });

  return Effect.runPromise(
    Effect.tryPromise({ try: () => execute({ ...body.success, traceId, traceparent: undefined }), catch: (cause): Error => cause instanceof Error ? cause : new Error("Request failed.") }).pipe(
      Effect.match({
        onFailure: (error) => {
          const failure = publicServerFailure(error);
          return Response.json({ error: failure.message }, { status: failure.status });
        },
        onSuccess: (result) => Response.json(result),
      })
    )
  );
}
