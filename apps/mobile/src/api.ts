import { Effect } from "effect";

import type { CaptureRoute, CompatibilityResult, MobileBootstrap, Collection, WardrobeItem, SelfieAnalysis } from "@/types";
import { analyticsHeaders, track } from "@/analytics";
import { createTraceId } from "@/trace";
import type { PlanningOperation } from "@wardrobe/shared";

const baseUrl = (process.env.EXPO_PUBLIC_WARDROBE_API_URL ?? "https://wardrobe.davidcschmitt.com").replace(/\/$/, "");
type GetToken = () => Promise<string | null>;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const request = <T>(getToken: GetToken, path: string, init?: RequestInit, operation = "bootstrap", traceId = createTraceId()) => {
  const started = Date.now();
  return Effect.gen(function* () {
    const token = yield* Effect.tryPromise({ try: () => getToken(), catch: () => new ApiError("Your session could not be read.", 401) });
    if (!token) return yield* Effect.fail(new ApiError("Sign in to continue.", 401));
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...analyticsHeaders(), "X-Wardrobe-Trace-ID": traceId, ...init?.headers },
      }),
      catch: () => new ApiError("Wardrobe could not be reached. Check your connection.", 0),
    });
    const payload = yield* Effect.tryPromise({
      try: () => response.json() as Promise<T & { error?: string }>,
      catch: () => new ApiError("Wardrobe returned an unreadable response.", response.status),
    });
    if (!response.ok) return yield* Effect.fail(new ApiError(payload.error ?? "Request failed.", response.status));
    return payload;
  }).pipe(
    Effect.tap(() => Effect.sync(() => track("native_request_completed", { operation, trace_id: traceId, duration_ms: Date.now() - started }))),
    Effect.tapError((error) => Effect.sync(() => track("native_request_failed", { operation, trace_id: traceId, status: error.status, duration_ms: Date.now() - started }))),
  );
};

export const loadBootstrap = (getToken: GetToken) => Effect.runPromise(request<MobileBootstrap>(getToken, "/api/mobile/bootstrap?v=2"));
export const planningRequest = <T>(getToken: GetToken, input: PlanningOperation) => Effect.runPromise(request<T>(getToken, "/api/planning", { method: "POST", body: JSON.stringify(input) }, input.operation));
export const transcribeDay = (getToken: GetToken, audio: string) => Effect.runPromise(request<{ text: string }>(getToken, "/api/transcribe", { method: "POST", body: JSON.stringify({ audio, mimeType: "audio/mp4", confirmed: true }) }, "transcribe"));

export const getUploadUrl = (getToken: GetToken) =>
  Effect.runPromise(request<{ uploadUrl: string }>(getToken, "/api/mobile/upload-url", { method: "POST" }, "upload_url"));

export const runCaptureOperation = <T>(
  getToken: GetToken,
  input: {
    operation: "route" | "record_fit" | "add_piece" | "try_on";
    scope?: "single_piece" | "full_fit";
    storageId: string;
    clientFileName?: string;
    contentType?: string;
    traceId?: string;
    traceparent?: string;
  }
) => {
  const traceId = input.traceId && /^[a-f0-9]{32}$/.test(input.traceId) ? input.traceId : createTraceId();
  return Effect.runPromise(request<T>(getToken, "/api/mobile/capture", { method: "POST", body: JSON.stringify({ ...input, traceId }) }, input.operation, traceId));
};

export const routeCapture = (getToken: GetToken, storageId: string, traceId?: string) =>
  runCaptureOperation<CaptureRoute>(getToken, { operation: "route", storageId, traceId });

export const tryOn = (getToken: GetToken, storageId: string, traceId?: string, scope?: "single_piece" | "full_fit") =>
  runCaptureOperation<CompatibilityResult>(getToken, { operation: "try_on", storageId, traceId, scope });

type ManageInput = {
  operation: "create_collection" | "add_collection_item" | "remove_collection_item" | "save_inspiration" | "update_bio" | "delete_item" | "analyze_selfie" | "resolve_observation" | "promote_observation" | "request_preview";
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

export const runManageOperation = <T>(getToken: GetToken, input: ManageInput) => {
  const traceId = input.traceId && /^[a-f0-9]{32}$/.test(input.traceId) ? input.traceId : createTraceId();
  return Effect.runPromise(request<T>(getToken, "/api/mobile/manage", { method: "POST", body: JSON.stringify({ ...input, traceId }) }, input.operation, traceId));
};

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

export const loadMobilePage = <T>(getToken: GetToken, view: "closet" | "plans" | "fits", cursor: string) => Effect.runPromise(request<{ page: T[]; isDone: boolean; continueCursor: string }>(getToken, `/api/mobile/data?view=${view}&cursor=${encodeURIComponent(cursor)}`));
export const loadCollection = (getToken: GetToken, id: string, cursor: string | null = null) => Effect.runPromise(request<Collection | null>(getToken, `/api/mobile/data?view=collection&id=${encodeURIComponent(id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`));

export const loadItem = (getToken: GetToken, id: string) => Effect.runPromise(request<WardrobeItem | null>(getToken, `/api/mobile/data?view=item&id=${encodeURIComponent(id)}`));

export const loadPreview = (getToken: GetToken, id: string) => Effect.runPromise(request<{ status: string; enabled: boolean; imageUrl: string | null } | null>(getToken, `/api/mobile/data?view=preview&id=${encodeURIComponent(id)}`));
export const changePreview = (getToken: GetToken, itemId: string, operation: "request_preview") => runManageOperation<{ success: boolean }>(getToken, { operation, itemId });
