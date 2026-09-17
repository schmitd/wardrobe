import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { StorageNotOwned } from "./errors";
import spec from "./storageMigration.spec";

const inventory = FunctionImpl.make(schema, spec, "inventory", ({ pagination }) => Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  const result = yield* Effect.promise(() => ctx.db.system.query("_storage").paginate({ ...pagination, numItems: Math.min(50, Math.max(1, pagination.numItems)) }));
  const page = yield* Effect.forEach(result.page, row => Effect.gen(function* () {
    const owner = yield* Effect.promise(() => ctx.db.query("storageObjects").withIndex("by_storage", q => q.eq("storageId", row._id)).unique());
    // Claims are investigation leads, never proof. The export includes no URLs or image contents.
    const claims = yield* Effect.promise(() => ctx.db.query("uploads").withIndex("by_storage", q => q.eq("storageId", row._id)).take(51));
    return { storageId: row._id, createdAt: row._creationTime, sha256: row.sha256, size: row.size, registeredClaims: [...new Set(claims.slice(0, 50).map(claim => claim.userId))], claimsTruncated: claims.length > 50, trustedOwner: owner?.userId ?? null };
  }));
  return { page, isDone: result.isDone, continueCursor: result.continueCursor };
}));
const approveReviewed = FunctionImpl.make(schema, spec, "approveReviewed", args => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const error = () => new StorageNotOwned({ message: "Legacy photo approval does not match the reviewed inventory." });
  if (!args.userId.trim() || args.evidence.trim().length < 20 || args.evidence.length > 2000) return yield* error();
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", args.userId)).first());
  const blob = yield* Effect.promise(() => ctx.db.system.get(args.storageId));
  if (deleted || !blob || blob.sha256 !== args.expectedSha256 || blob._creationTime !== args.expectedCreatedAt) return yield* error();
  const owner = yield* Effect.promise(() => ctx.db.query("storageObjects").withIndex("by_storage", q => q.eq("storageId", args.storageId)).unique());
  if (owner) {
    if (owner.userId !== args.userId) return yield* error();
    return null;
  }
  yield* Effect.promise(() => ctx.db.insert("storageObjects", { storageId: args.storageId, userId: args.userId, provenance: "reviewed_legacy", createdAt: blob._creationTime, reviewEvidence: args.evidence.trim(), reviewedAt: Date.now() }));
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(Layer.mergeAll(inventory, approveReviewed)), GroupImpl.finalize);
