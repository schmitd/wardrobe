import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import { internal } from "../convex/_generated/api";
import schema from "./_generated/schema";
import { MutationCtx } from "./_generated/services";
import spec from "./account.spec";

const tables = ["styleBioJobs", "uploadTickets", "wardrobeItems", "garmentPreviewJobs", "candidateItems", "profiles", "wardrobes", "wardrobeMemberships", "fitChecks", "fitCheckItems", "garmentObservations", "uploads", "subscriptions", "profileBioRevisions", "outfitSuggestions", "planningSettings"] as const;
const batchSize = 100;
const deleteUserData = FunctionImpl.make(schema, spec, "deleteUserData", ({ userId }): Effect.Effect<{ scheduled: true }, never, MutationCtx> => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first());
  // The tombstone revokes every outstanding ticket atomically and prevents stale
  // authenticated requests from recreating rows while cleanup runs.
  if (!deleted) yield* Effect.promise(() => ctx.db.insert("deletedAccounts", { userId, deletedAt: Date.now() }));
  yield* Effect.promise(() => ctx.scheduler.runAfter(0, internal.account.deleteBatch, { userId, tableIndex: 0 }));
  return { scheduled: true as const };
}));
const deleteBatch = FunctionImpl.make(schema, spec, "deleteBatch", ({ userId, tableIndex }): Effect.Effect<null, never, MutationCtx> => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first());
  if (!deleted || !Number.isInteger(tableIndex) || tableIndex < 0 || tableIndex > tables.length) return null;
  if (tableIndex === tables.length) {
    // Application references are not authority to delete a blob.
    const objects = yield* Effect.promise(() => ctx.db.query("storageObjects").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize));
    for (const object of objects) {
      yield* Effect.promise(() => ctx.storage.delete(object.storageId));
      yield* Effect.promise(() => ctx.db.delete(object._id));
    }
    if (objects.length === batchSize) yield* Effect.promise(() => ctx.scheduler.runAfter(0, internal.account.deleteBatch, { userId, tableIndex }));
    return null;
  }
  const rows = yield* Effect.promise(() => ctx.db.query(tables[tableIndex]!).withIndex("by_user", q => q.eq("userId", userId)).take(batchSize));
  for (const row of rows) yield* Effect.promise(() => ctx.db.delete(row._id));
  yield* Effect.promise(() => ctx.scheduler.runAfter(0, internal.account.deleteBatch, { userId, tableIndex: rows.length === batchSize ? tableIndex : tableIndex + 1 }));
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(Layer.mergeAll(deleteUserData, deleteBatch)), GroupImpl.finalize);
