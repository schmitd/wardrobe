import type { GetToken } from "@clerk/types";
import { Effect } from "effect";

import type { CaptureRoute, CompatibilityResult, MobileBootstrap } from "@/types";

const baseUrl = (process.env.EXPO_PUBLIC_WARDROBE_API_URL ?? "https://wardrobe.davidcschmitt.com").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const request = <T>(getToken: GetToken, path: string, init?: RequestInit) =>
  Effect.gen(function* () {
    const token = yield* Effect.tryPromise({ try: () => getToken(), catch: () => new ApiError("Your session could not be read.", 401) });
    if (!token) return yield* Effect.fail(new ApiError("Sign in to continue.", 401));
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
      }),
      catch: () => new ApiError("Wardrobe could not be reached. Check your connection.", 0),
    });
    const payload = yield* Effect.tryPromise({
      try: () => response.json() as Promise<T & { error?: string }>,
      catch: () => new ApiError("Wardrobe returned an unreadable response.", response.status),
    });
    if (!response.ok) return yield* Effect.fail(new ApiError(payload.error ?? "Request failed.", response.status));
    return payload;
  });

export const loadBootstrap = (getToken: GetToken) => Effect.runPromise(request<MobileBootstrap>(getToken, "/api/mobile/bootstrap"));

export const getUploadUrl = (getToken: GetToken) =>
  Effect.runPromise(request<{ uploadUrl: string }>(getToken, "/api/mobile/upload-url", { method: "POST" }));

export const runCaptureOperation = <T>(
  getToken: GetToken,
  input: {
    operation: "route" | "record_fit" | "add_piece" | "try_on";
    storageId: string;
    clientFileName?: string;
    contentType?: string;
    traceId?: string;
    traceparent?: string;
  }
) => Effect.runPromise(request<T>(getToken, "/api/mobile/capture", { method: "POST", body: JSON.stringify(input) }));

export const routeCapture = (getToken: GetToken, storageId: string) =>
  runCaptureOperation<CaptureRoute>(getToken, { operation: "route", storageId });

export const tryOn = (getToken: GetToken, storageId: string) =>
  runCaptureOperation<CompatibilityResult>(getToken, { operation: "try_on", storageId });
