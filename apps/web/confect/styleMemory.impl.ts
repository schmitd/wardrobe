import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Exit, Layer } from "effect";
import { internal } from "../convex/_generated/api";
import { ActionCtx } from "./_generated/services";
import schema from "./_generated/schema";
import spec from "./styleMemory.spec";
import { generateMaintainedStyleBio } from "../src/server/inference/styleBio";
import { GeminiLive } from "../src/services/GeminiService";
import { truncateWords } from "../src/lib/inferenceOutputGuards";
import { searchStyleBioGraphContext } from "./legacy/zep";

const refresh = FunctionImpl.make(schema, spec, "refresh", ({ userId }): Effect.Effect<null, never, ActionCtx> => Effect.gen(function* () {
  const ctx = yield* ActionCtx;
  const snapshot = yield* Effect.promise(() => ctx.runQuery(internal.styleMemoryData.load, { userId }));
  if (!snapshot) return null;
  const work = Effect.gen(function* () {
    const context = snapshot.context;
    if (!context.shouldRefresh) return;
    const currentBio = context.profile?.bio ?? "";
    const manualAnchor = context.profile?.bioManualAnchor ?? "";
    const graphFacts = yield* Effect.tryPromise({ try: () => searchStyleBioGraphContext(userId), catch: () => new Error("Style graph unavailable") }).pipe(Effect.timeout("10 seconds"), Effect.catch(() => Effect.succeed([] as string[])));
    const generated = context.counts.closetItemCount + context.counts.fitCheckCount + context.counts.collectionCount === 0
      ? { bio: manualAnchor || currentBio || "I'm building a clearer picture of what I like to wear. As my closet and outfit notes grow, this space will track the colors, shapes, textures, and combinations I return to without guessing ahead of the evidence." }
      : yield* generateMaintainedStyleBio({ currentBio, manualAnchor, refreshReason: context.refreshReason, closetItems: context.closetItems, recentFits: context.recentFits, collections: context.collections, graphFacts }).pipe(Effect.provide(GeminiLive));
    yield* Effect.promise(() => ctx.runMutation(internal.styleMemoryData.save, {
      userId, jobRevision: snapshot.revision, bio: truncateWords(generated.bio, 110), reason: context.refreshReason, contextFingerprint: context.fingerprint, ...context.counts,
      ...(context.profile?.bioRevisionId ? { baseRevisionId: context.profile.bioRevisionId } : {}),
    }));
  });
  // Observe both typed failures and defects so every normal action exit releases
  // the durable job and retries failures without affecting the original mutation.
  const result = yield* Effect.exit(work);
  yield* Effect.promise(() => ctx.runMutation(internal.styleMemoryData.finish, { userId, revision: snapshot.revision, success: Exit.isSuccess(result) }));
  if (Exit.isFailure(result)) yield* Effect.logWarning("style_bio.refresh.failed");
  return null;
}));
export default GroupImpl.make(schema, spec).pipe(Layer.provide(refresh), GroupImpl.finalize);
