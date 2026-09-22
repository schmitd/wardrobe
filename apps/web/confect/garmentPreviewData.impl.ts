import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import spec from "./garmentPreviewData.spec";
import { CurrentUser } from "./middleware/RequireUser.spec";
import RequireUserLive from "./middleware/RequireUser.impl";
import { StorageNotOwned } from "./errors";
import { queuePreview, wardrobeDisplayUrl } from "./previewQueue";
import { deleteGeneratedPreview, discardUnregisteredPreview, ownedStorageUrl } from "./storageAccess";

const request = FunctionImpl.make(schema, spec, "request", ({ itemId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const { userId } = yield* CurrentUser;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (!item || item.userId !== userId) return yield* new StorageNotOwned({ message: "Item unavailable." });
  return yield* Effect.promise(() => queuePreview(ctx, itemId, false));
}));
const restore = FunctionImpl.make(schema, spec, "restore", ({ itemId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const { userId } = yield* CurrentUser;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (!item || item.userId !== userId) return yield* new StorageNotOwned({ message: "Item unavailable." });
  // Invalidate in-flight work in the same transaction as restoring the original.
  yield* Effect.promise(() => ctx.db.patch(itemId, { previewStatus: "original", previewRevision: (item.previewRevision ?? 0) + 1, previewStorageId: undefined }));
  if (item.previewStorageId) {
    yield* deleteGeneratedPreview(ctx, userId, item.previewStorageId);
  }
  return null;
}));
const status = FunctionImpl.make(schema, spec, "status", ({ itemId }) => Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  const { userId } = yield* CurrentUser;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (!item || item.userId !== userId) return null;
  return { status: item.previewStatus ?? "original", enabled: process.env.GARMENT_PREVIEWS_ENABLED === "true", imageUrl: yield* Effect.promise(() => wardrobeDisplayUrl(ctx, userId, item)) };
}));
const claim = FunctionImpl.make(schema, spec, "claim", ({ itemId, revision }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (!item || item.previewRevision !== revision || item.previewStatus !== "queued") return null;
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", item.userId)).first());
  const url = yield* Effect.promise(() => ownedStorageUrl(ctx, item.userId, item.storageId));
  if (deleted || !url || process.env.GARMENT_PREVIEWS_ENABLED !== "true") {
    yield* Effect.promise(() => ctx.db.patch(itemId, { previewStatus: "error" }));
    return null;
  }
  yield* Effect.promise(() => ctx.db.patch(itemId, { previewStatus: "processing" }));
  return { userId: item.userId, storageId: item.storageId, traceId: item.traceId ?? null };
}));
const commit = FunctionImpl.make(schema, spec, "commit", ({ itemId, revision, storageId, sourceStorageId, userId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first());
  const existing = yield* Effect.promise(() => ctx.db.query("storageObjects").withIndex("by_storage", q => q.eq("storageId", storageId)).unique());
  if (existing || deleted || !item || item.userId !== userId || item.storageId !== sourceStorageId || item.previewRevision !== revision || item.previewStatus !== "processing") return false;
  if (!(yield* Effect.promise(() => ownedStorageUrl(ctx, userId, sourceStorageId)))) return false;
  yield* Effect.promise(() => ctx.db.insert("storageObjects", { userId, storageId, provenance: "generated_preview", createdAt: Date.now() }));
  yield* Effect.promise(() => ctx.db.patch(itemId, { previewStorageId: storageId, previewStatus: "ready" }));
  return true;
}));
const finish = FunctionImpl.make(schema, spec, "finish", ({ itemId, revision, skipped }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (item?.previewRevision === revision && (item.previewStatus === "queued" || item.previewStatus === "processing"))
    yield* Effect.promise(() => ctx.db.patch(itemId, { previewStatus: skipped ? "skipped" : "error" }));
  return null;
}));
const expire = FunctionImpl.make(schema, spec, "expire", ({ itemId, revision }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const item = yield* Effect.promise(() => ctx.db.get(itemId));
  if (item?.previewRevision === revision && (item.previewStatus === "queued" || item.previewStatus === "processing"))
    yield* Effect.promise(() => ctx.db.patch(itemId, { previewStatus: "error" }));
  return null;
}));
const discard = FunctionImpl.make(schema, spec, "discard", ({ storageId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  // A commit may have succeeded even if its acknowledgement was interrupted.
  yield* discardUnregisteredPreview(ctx, storageId);
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(Layer.mergeAll(request, restore, status, claim, commit, finish, expire, discard, RequireUserLive)), GroupImpl.finalize);
