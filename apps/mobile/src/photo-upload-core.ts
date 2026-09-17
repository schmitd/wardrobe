import { Data, Effect } from "effect";

export class PhotoUploadError extends Data.TaggedError("PhotoUploadError")<{
  stage: "prepare" | "authorize" | "transfer" | "response";
  message: string;
  status?: number;
}> {}

export type UploadResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type PhotoUploadDependencies<Body> = {
  prepare: (uri: string, width: number) => Promise<string>;
  authorize: () => Promise<{ uploadUrl: string }>;
  open: (uri: string) => Body;
  transfer: (uploadUrl: string, body: Body, signal?: AbortSignal) => Promise<UploadResponse>;
};

const messageFrom = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

export const photoUploadEffect = <Body>(
  dependencies: PhotoUploadDependencies<Body>,
  uri: string,
  width: number
) => Effect.gen(function* () {
  const preparedUri = yield* Effect.tryPromise({
    try: () => dependencies.prepare(uri, width),
    catch: () => new PhotoUploadError({ stage: "prepare", message: "This photo could not be prepared." }),
  });
  const { uploadUrl } = yield* Effect.tryPromise({
    try: dependencies.authorize,
    catch: (cause) => new PhotoUploadError({
      stage: "authorize",
      message: messageFrom(cause, "Upload could not start."),
    }),
  });
  const body = yield* Effect.try({
    try: () => dependencies.open(preparedUri),
    catch: (cause) => new PhotoUploadError({
      stage: "prepare",
      message: messageFrom(cause, "This photo could not be opened."),
    }),
  });
  const response = yield* Effect.tryPromise({
    try: signal => dependencies.transfer(uploadUrl, body, signal),
    catch: () => new PhotoUploadError({ stage: "transfer", message: "Upload failed. Check your connection." }),
  });
  if (!response.ok) {
    return yield* Effect.fail(new PhotoUploadError({
      stage: "transfer",
      status: response.status,
      message: response.status === 413 ? "Choose a photo smaller than 20 MB." : response.status === 403 ? "The upload expired. Please try again." : `Upload failed (${response.status}). Please try again.`,
    }));
  }
  const payload = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new PhotoUploadError({ stage: "response", message: "Upload response could not be read." }),
  });
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("storageId" in payload) ||
    typeof payload.storageId !== "string" ||
    !payload.storageId
  ) {
    return yield* Effect.fail(new PhotoUploadError({
      stage: "response",
      message: "Upload did not return a photo reference.",
    }));
  }
  return payload.storageId;
}).pipe(Effect.timeout("90 seconds"), Effect.catchTag("TimeoutError", () => Effect.fail(new PhotoUploadError({ stage: "transfer", message: "The upload took too long. Please try again." }))));
