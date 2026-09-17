import { PHOTO_UPLOAD_MAX_BYTES } from "@wardrobe/shared";
import { Data, Effect, Schema } from "effect";

export class PhotoUploadError extends Data.TaggedError("PhotoUploadError")<{ message: string }> {}
const UploadResponse = Schema.Struct({ storageId: Schema.String.check(Schema.isNonEmpty()) });

/** The upload capability is scoped to one attempt; retry obtains a new URL. */
export const uploadPhoto = (photo: Blob, getUploadUrl: () => Promise<string>, fetchImpl: typeof fetch = fetch) => Effect.gen(function* () {
  if (!photo.type.startsWith("image/")) return yield* new PhotoUploadError({ message: "Choose a photo file to continue." });
  if (!photo.size) return yield* new PhotoUploadError({ message: "The photo is empty. Choose another photo." });
  if (photo.size > PHOTO_UPLOAD_MAX_BYTES) return yield* new PhotoUploadError({ message: "Choose a photo smaller than 20 MB." });
  const url = yield* Effect.tryPromise({ try: getUploadUrl, catch: () => new PhotoUploadError({ message: "Could not start the upload. Sign in and try again." }) });
  const response = yield* Effect.tryPromise({
    try: signal => fetchImpl(url, { method: "POST", headers: { "Content-Type": photo.type }, body: photo, signal }),
    catch: () => new PhotoUploadError({ message: "Photo upload failed. Check your connection and try again." }),
  });
  if (!response.ok) return yield* new PhotoUploadError({ message: response.status === 413
    ? "Choose a photo smaller than 20 MB." : response.status === 403
      ? "The upload expired. Please try again." : "Photo storage is unavailable. Please try again." });
  const payload = yield* Effect.tryPromise({ try: () => response.json(), catch: () => new PhotoUploadError({ message: "The upload could not be confirmed. Please try again." }) });
  const parsed = yield* Schema.decodeUnknownEffect(UploadResponse)(payload).pipe(Effect.mapError(() => new PhotoUploadError({ message: "The upload could not be confirmed. Please try again." })));
  return parsed.storageId;
}).pipe(Effect.timeout("90 seconds"), Effect.catchTag("TimeoutError", () => Effect.fail(new PhotoUploadError({ message: "The upload took too long. Please try again." }))));

/** Promise boundary for React event handlers and existing async adapters. */
export const uploadPhotoFile = (photo: Blob, getUploadUrl: () => Promise<string>) => Effect.runPromise(uploadPhoto(photo, getUploadUrl));
