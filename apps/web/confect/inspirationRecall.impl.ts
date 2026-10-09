import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import schema from "./_generated/schema";
import { QueryCtx } from "./_generated/services";
import spec from "./inspirationRecall.spec";

const active = FunctionImpl.make(schema, spec, "active", ({ userId, references }) => Effect.gen(function* () {
  const ctx = yield* QueryCtx;
  // Graph search is capped at 20 edges. Never allow a recall check to scan an account.
  if (references.length > 40) return references.map(() => false);
  return yield* Effect.forEach(references, reference => Effect.gen(function* () {
    const candidateId = ctx.db.normalizeId("candidateItems", reference.candidateItemId);
    const wardrobeId = reference.wardrobeId ? ctx.db.normalizeId("wardrobes", reference.wardrobeId) : null;
    if (!candidateId || (reference.wardrobeId && !wardrobeId)) return false;
    const candidate = yield* Effect.promise(() => ctx.db.get(candidateId));
    if (!candidate || candidate.userId !== userId) return false;
    if (candidate.kind !== "inspiration") {
      return !wardrobeId; // Preserve unrelated owned candidate facts, never authorize an inspiration relationship.
    }
    const members = yield* Effect.promise(() => wardrobeId
      ? ctx.db.query("wardrobeMemberships").withIndex("by_candidate_wardrobe", q => q.eq("candidateItemId", candidateId).eq("wardrobeId", wardrobeId)).take(100)
      : ctx.db.query("wardrobeMemberships").withIndex("by_candidate", q => q.eq("candidateItemId", candidateId)).take(100));
    for (const member of members) {
      if (member.userId !== userId || member.removed || member.itemId || member.membershipKind !== "inspiration") continue;
      const collection = yield* Effect.promise(() => ctx.db.get(member.wardrobeId));
      if (collection?.userId === userId && !collection.archived) return true;
    }
    return false;
  }));
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(active), GroupImpl.finalize);
