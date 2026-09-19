import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { StorageNotOwned } from "./errors";
import RequireUserLive from "./middleware/RequireUser.impl";
import { CurrentUser } from "./middleware/RequireUser.spec";
import { StorageAccess } from "./storageAccess";
import spec from "./storage.spec";

const readAccess = Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  const { userId } = yield* CurrentUser;
  return yield* StorageAccess.pipe(Effect.provide(StorageAccess.layer(ctx, userId)));
});
const registerUpload = FunctionImpl.make(schema, spec, "registerUpload", args => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const { userId } = yield* CurrentUser;
  const access = yield* StorageAccess.pipe(Effect.provide(StorageAccess.layer(ctx, userId)));
  yield* access.requireOwned(args.storageId);
  const existing = yield* Effect.promise(() => ctx.db.query("uploads").withIndex("by_user_storage", q => q.eq("userId", userId).eq("storageId", args.storageId)).first());
  if (!existing) yield* Effect.promise(() => ctx.db.insert("uploads", { ...args, userId, createdAt: Date.now() }));
  return { ok: true as const };
}));
const getStorageUrl = FunctionImpl.make(schema, spec, "getStorageUrl", ({ storageId }) => Effect.gen(function* () {
  const access = yield* readAccess;
  yield* access.requireOwned(storageId);
  return yield* access.url(storageId);
}));
const getCaptureRoute = FunctionImpl.make(schema, spec, "getCaptureRoute", ({ storageId }) => Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  const { userId } = yield* CurrentUser;
  const access = yield* readAccess;
  yield* access.requireOwned(storageId);
  const upload = yield* Effect.promise(() => ctx.db.query("uploads").withIndex("by_user_storage", q => q.eq("userId", userId).eq("storageId", storageId)).first());
  return upload?.captureRoute ?? null;
}));
const saveCaptureRoute = FunctionImpl.make(schema, spec, "saveCaptureRoute", ({ storageId, route }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const { userId } = yield* CurrentUser;
  const access = yield* StorageAccess.pipe(Effect.provide(StorageAccess.layer(ctx, userId)));
  yield* access.requireOwned(storageId);
  const upload = yield* Effect.promise(() => ctx.db.query("uploads").withIndex("by_user_storage", q => q.eq("userId", userId).eq("storageId", storageId)).first());
  if (!upload) return yield* new StorageNotOwned({ message: "Register the uploaded photo before routing it." });
  yield* Effect.promise(() => ctx.db.patch(upload._id, { captureRoute: route }));
  return route;
}));
const getLatestUploadByPurpose = FunctionImpl.make(schema, spec, "getLatestUploadByPurpose", ({ purpose }) => Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  const { userId } = yield* CurrentUser;
  const upload = yield* Effect.promise(() => ctx.db.query("uploads").withIndex("by_user_purpose_createdAt", q => q.eq("userId", userId).eq("purpose", purpose)).order("desc").first());
  if (!upload) return null;
  const access = yield* readAccess;
  const url = yield* access.url(upload.storageId);
  return url ? { storageId: upload.storageId, url, createdAt: upload.createdAt } : null;
}));
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(Layer.mergeAll(registerUpload, getStorageUrl, getCaptureRoute, saveCaptureRoute, getLatestUploadByPurpose, RequireUserLive)), GroupImpl.finalize,
);
