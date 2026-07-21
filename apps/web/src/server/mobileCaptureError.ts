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

export const publicCaptureError = (failure: MobileCaptureFailure) => {
  const message = failure.message;

  if (message === "Unauthorized" || message === "Missing Convex token") {
    return { status: 401, message } as const;
  }
  if (/limit reached|too many requests/i.test(message)) {
    return { status: 429, message } as const;
  }
  if (/automated traffic|request blocked/i.test(message)) {
    return { status: 403, message } as const;
  }
  if (/security checks are unavailable/i.test(message)) {
    return { status: 503, message } as const;
  }
  return { status: 500, message: GENERIC_CAPTURE_MESSAGE } as const;
};
