import { Effect } from "effect";

import type { CaptureRoute, CompatibilityResult, MobileBootstrap, SelfieAnalysis } from "@/types";

const baseUrl = (process.env.EXPO_PUBLIC_WARDROBE_API_URL ?? "https://wardrobe.davidcschmitt.com").replace(/\/$/, "");
type GetToken = () => Promise<string | null>;

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

type ManageInput = {
  operation: "create_collection" | "add_collection_item" | "remove_collection_item" | "save_inspiration" | "update_bio" | "delete_item" | "analyze_selfie" | "resolve_observation" | "promote_observation";
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

export const runManageOperation = <T>(getToken: GetToken, input: ManageInput) =>
  Effect.runPromise(request<T>(getToken, "/api/mobile/manage", { method: "POST", body: JSON.stringify(input) }));

export const createCollection = (getToken: GetToken, input: { name: string; description?: string; traceId?: string }) =>
  runManageOperation<{ id: string }>(getToken, { operation: "create_collection", ...input });

export const addCollectionItem = (getToken: GetToken, wardrobeId: string, itemId: string) =>
  runManageOperation<{ success: boolean }>(getToken, { operation: "add_collection_item", wardrobeId, itemId });

export const removeCollectionItem = (getToken: GetToken, wardrobeId: string, itemId: string) =>
  runManageOperation<{ success: boolean }>(getToken, { operation: "remove_collection_item", wardrobeId, itemId });

export const saveInspiration = (getToken: GetToken, wardrobeId: string, storageId: string, traceId?: string) =>
  runManageOperation<{ id: string }>(getToken, { operation: "save_inspiration", wardrobeId, storageId, traceId });

export const updateBio = (getToken: GetToken, bio: string, traceId?: string) =>
  runManageOperation<{ success: boolean }>(getToken, { operation: "update_bio", bio, traceId });

export const deleteItem = (getToken: GetToken, itemId: string, reason: string, traceId?: string) =>
  runManageOperation<{ success: boolean }>(getToken, { operation: "delete_item", itemId, reason, traceId });

export const analyzeSelfie = (getToken: GetToken, storageId: string, traceId?: string) =>
  runManageOperation<SelfieAnalysis>(getToken, { operation: "analyze_selfie", storageId, traceId });

export const resolveObservation = (getToken: GetToken, observationId: string, itemId: string) =>
  runManageOperation<{ success: boolean }>(getToken, { operation: "resolve_observation", observationId, itemId });

export const promoteObservation = (getToken: GetToken, observationId: string) =>
  runManageOperation<{ success: boolean; wardrobeItemId: string }>(getToken, { operation: "promote_observation", observationId });
