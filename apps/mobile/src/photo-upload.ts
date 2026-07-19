import { Effect } from "effect";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { getUploadUrl } from "@/api";

type GetToken = () => Promise<string | null>;

export const uploadPhoto = (getToken: GetToken, uri: string, width = 1600) =>
  Effect.runPromise(Effect.gen(function* () {
    const prepared = yield* Effect.tryPromise({
      try: () => manipulateAsync(uri, [{ resize: { width } }], { compress: 0.8, format: SaveFormat.JPEG }),
      catch: () => new Error("This photo could not be prepared."),
    });
    const { uploadUrl } = yield* Effect.tryPromise({
      try: () => getUploadUrl(getToken),
      catch: (cause) => cause instanceof Error ? cause : new Error("Upload could not start."),
    });
    const image = yield* Effect.tryPromise({
      try: () => fetch(prepared.uri).then((response) => response.blob()),
      catch: () => new Error("This photo could not be opened."),
    });
    const response = yield* Effect.tryPromise({
      try: () => fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: image }),
      catch: () => new Error("Upload failed. Check your connection."),
    });
    if (!response.ok) return yield* Effect.fail(new Error("Upload failed. Please try again."));
    const payload = yield* Effect.tryPromise({
      try: () => response.json() as Promise<{ storageId?: string }>,
      catch: () => new Error("Upload response could not be read."),
    });
    if (!payload.storageId) return yield* Effect.fail(new Error("Upload did not return a photo reference."));
    return payload.storageId;
  }));
