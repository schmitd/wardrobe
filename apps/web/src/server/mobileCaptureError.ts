import { publicServerFailure } from "./errors";
import { Data } from "effect";

const GENERIC_CAPTURE_MESSAGE = "Could not save this photo right now.";

export class MobileCaptureFailure extends Data.TaggedError("MobileCaptureFailure")<{
  readonly cause: unknown;
  readonly message: string;
  readonly operation?: string;
  readonly traceId?: string;
}> {}

export const toMobileCaptureFailure = (cause: unknown) =>
  new MobileCaptureFailure({
    cause,
    message: cause instanceof Error ? cause.message : String(cause),
  });

export const publicCaptureError = (failure: MobileCaptureFailure) =>
  publicServerFailure(failure.cause, GENERIC_CAPTURE_MESSAGE);
