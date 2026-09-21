import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import schema from "./_generated/schema";
import { MutationCtx } from "./_generated/services";
import { InvalidUploadTicket } from "./errors";
import spec from "./uploads.spec";
const invalid = () => new InvalidUploadTicket({ message: "Upload authorization expired. Please try again." });
const claim = FunctionImpl.make(schema, spec, "claim", ({ token }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const ticket = yield* Effect.promise(() => ctx.db.query("uploadTickets").withIndex("by_token", q => q.eq("token", token)).unique());
  if (!ticket || ticket.state !== "issued" || ticket.expiresAt <= Date.now()) return yield* invalid();
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", ticket.userId)).unique());
  if (deleted) return yield* invalid();
  yield* Effect.promise(() => ctx.db.patch(ticket._id, { state: "claimed" }));
  return ticket._id;
}));
const finalize = FunctionImpl.make(schema, spec, "finalize", ({ ticketId, storageId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const ticket = yield* Effect.promise(() => ctx.db.get(ticketId));
  if (!ticket || ticket.state !== "claimed" || ticket.expiresAt <= Date.now()) return yield* invalid();
  const deleted = yield* Effect.promise(() => ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", ticket.userId)).unique());
  if (deleted) return yield* invalid();
  const existing = yield* Effect.promise(() => ctx.db.query("storageObjects").withIndex("by_storage", q => q.eq("storageId", storageId)).unique());
  if (existing) return yield* invalid();
  yield* Effect.promise(() => ctx.db.insert("storageObjects", { storageId, userId: ticket.userId, provenance: "upload", createdAt: Date.now() }));
  yield* Effect.promise(() => ctx.db.delete(ticketId));
  return null;
}));
const expire = FunctionImpl.make(schema, spec, "expire", ({ ticketId }) => Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  const ticket = yield* Effect.promise(() => ctx.db.get(ticketId));
  if (ticket && ticket.expiresAt <= Date.now()) yield* Effect.promise(() => ctx.db.delete(ticketId));
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(Layer.mergeAll(claim, finalize, expire)), GroupImpl.finalize);
