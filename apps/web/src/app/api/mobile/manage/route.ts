import { Effect } from "effect";
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

type ManageBody = {
  operation?: "create_collection" | "add_collection_item" | "remove_collection_item" | "save_inspiration" | "update_bio" | "delete_item" | "analyze_selfie" | "resolve_observation" | "promote_observation";
  wardrobeId?: string;
  itemId?: string;
  observationId?: string;
  storageId?: string;
  name?: string;
  description?: string;
  bio?: string;
  reason?: string;
  traceId?: string;
  traceparent?: string;
};

const required = (value: string | undefined, label: string) => {
  if (!value?.trim()) throw new Error(`Missing ${label}.`);
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
      throw new Error("Unknown mobile operation.");
  }
};

export async function POST(request: Request) {
  return observeMobileRequest(request, "manage", handleManage);
}

async function handleManage(request: Request) {
  const body = await Effect.runPromise(
    Effect.tryPromise({
      try: () => request.json() as Promise<ManageBody>,
      catch: () => new Error("The request body could not be read."),
    }).pipe(Effect.either)
  );
  if (body._tag === "Left") return Response.json({ error: body.left.message }, { status: 400 });

  return Effect.runPromise(
    Effect.tryPromise({ try: () => execute({ ...body.right, traceId: request.headers.get("X-Wardrobe-Trace-ID") ?? undefined, traceparent: undefined }), catch: (cause): Error => cause instanceof Error ? cause : new Error("Request failed.") }).pipe(
      Effect.match({
        onFailure: (error) => {
          const unauthorized = error.message === "Unauthorized" || error.message === "Missing Convex token";
          return Response.json({ error: unauthorized ? error.message : error.message || "Request failed." }, { status: unauthorized ? 401 : 400 });
        },
        onSuccess: (result) => Response.json(result),
      })
    )
  );
}
