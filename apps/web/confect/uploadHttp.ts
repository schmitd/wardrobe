import { Data, Effect, Exit } from "effect";
import { httpAction } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
import { MAX_UPLOAD_BYTES } from "./uploadPolicy";
const cors = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Digest", "Access-Control-Max-Age": "86400", "Cache-Control": "no-store",
};
class UploadRequestError extends Data.TaggedError("UploadRequestError")<{ status: number; message: string }> {}
export const uploadOptions = httpAction(async () => new Response(null, { status: 204, headers: cors }));
export const upload = httpAction((ctx, request) => Effect.runPromise(Effect.gen(function* () {
  const token = new URL(request.url).searchParams.get("ticket");
  if (!token) return yield* new UploadRequestError({ status: 403, message: "Upload authorization is missing." });
  if (Number(request.headers.get("Content-Length")) > MAX_UPLOAD_BYTES) return yield* new UploadRequestError({ status: 413, message: "Choose a photo smaller than 20 MB." });
  const ticketId = yield* Effect.tryPromise({ try: () => ctx.runMutation(internal.uploads.claim, { token }), catch: () => new UploadRequestError({ status: 403, message: "Upload authorization expired. Please try again." }) });
  const blob = yield* Effect.tryPromise({ try: () => request.blob(), catch: () => new UploadRequestError({ status: 400, message: "The photo could not be read. Please try again." }) });
  if (!blob.size || blob.size > MAX_UPLOAD_BYTES) return yield* new UploadRequestError({ status: blob.size ? 413 : 400, message: blob.size ? "Choose a photo smaller than 20 MB." : "The photo was empty." });
  return yield* Effect.acquireUseRelease(
    Effect.tryPromise({ try: () => ctx.storage.store(blob), catch: () => new UploadRequestError({ status: 503, message: "Photo storage is unavailable. Please try again." }) }),
    storageId => Effect.tryPromise({ try: () => ctx.runMutation(internal.uploads.finalize, { ticketId, storageId }), catch: () => new UploadRequestError({ status: 403, message: "Upload authorization expired. Please try again." }) }).pipe(Effect.as(Response.json({ storageId }, { headers: cors }))),
    (storageId, exit) => Exit.isFailure(exit) ? Effect.promise(() => ctx.storage.delete(storageId)) : Effect.void,
  );
}).pipe(Effect.catchTag("UploadRequestError", error => Effect.succeed(Response.json({ error: error.message }, { status: error.status, headers: cors }))))));
