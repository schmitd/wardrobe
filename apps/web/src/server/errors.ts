import { Data } from "effect";

export class RequestFailure extends Data.TaggedError("RequestFailure")<{
  status: 400 | 401 | 403 | 409 | 413 | 429 | 502 | 503;
  message: string;
}> {}

/** Only explicitly public errors cross an HTTP boundary; provider details stay private. */
export function publicServerFailure(error: unknown, fallback = "Could not complete this request. Please try again.") {
  if (error instanceof RequestFailure) return { status: error.status, message: error.message };
  const data = typeof error === "object" && error !== null && "data" in error ? error.data : null;
  if (typeof data === "object" && data !== null && "_tag" in data) {
    if (data._tag === "NotAuthenticated") return { status: 401, message: "Sign in to continue." };
    if (data._tag === "StorageNotOwned") return { status: 403, message: "Photo unavailable. Please upload it again." };
    if (data._tag === "PlanningLimit") return { status: 429, message: "Please wait 30 seconds before trying again." };
    if ((data._tag === "PlanningInput" || data._tag === "InvalidInput") && "message" in data && typeof data.message === "string") return { status: 400, message: data.message };
  }
  return { status: 500, message: fallback };
}
