import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";

const toErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export const createInspiration = mutation({
  args: {
    wardrobeId: v.id("wardrobes"), storageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()), sourceLabel: v.optional(v.string()),
    category: v.optional(v.string()), description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())), embedding: v.optional(v.array(v.float64())),
    traceId: v.optional(v.string()), traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const wardrobe = await ctx.db.get(args.wardrobeId);
    if (!wardrobe || wardrobe.userId !== user.userId) throw new Error("Collection not found");
    if (!args.storageId && !args.sourceUrl) throw new Error("Add an image or source URL");
    if (args.storageId) {
      const upload = await ctx.db.query("uploads").withIndex("by_user_storage", (q) => q.eq("userId", user.userId).eq("storageId", args.storageId!)).first();
      if (!upload) throw new Error("Upload not registered");
    }
    const { traceId, traceparent } = ensureTraceContext(args);
    const timestamp = Date.now();
    const candidateItemId = await ctx.db.insert("candidateItems", {
      userId: user.userId, storageId: args.storageId, sourceUrl: args.sourceUrl,
      sourceLabel: args.sourceLabel, kind: "inspiration", status: "active",
      category: args.category, description: args.description, styleTags: args.styleTags,
      embedding: args.embedding, traceId, traceparent, createdAt: timestamp, updatedAt: timestamp,
    });
    await ctx.db.insert("wardrobeMemberships", {
      userId: user.userId, wardrobeId: args.wardrobeId, candidateItemId,
      membershipKind: "inspiration", rationale: args.description,
      createdAt: timestamp, updatedAt: timestamp,
    });
    if ((args.styleTags ?? []).length > 0) try {
      await retrier.run(ctx, internal.zepSync.syncCandidateInspiration, {
        userId: user.userId, user, candidateItemId, wardrobeId: args.wardrobeId,
        wardrobeName: wardrobe.name, wardrobeKind: wardrobe.kind,
        wardrobeStatus: wardrobe.status, wardrobeDescription: wardrobe.description,
        wardrobeMoodWords: wardrobe.moodWords ?? [], storageId: args.storageId,
        sourceUrl: args.sourceUrl, sourceLabel: args.sourceLabel, category: args.category,
        description: args.description, styleTags: args.styleTags, traceId, traceparent,
      });
    } catch (error) {
      console.warn("zep.sync.candidate_inspiration.enqueue_failed", { traceId, traceparent, candidateItemId, message: toErrorMessage(error) });
    }
    return { id: candidateItemId };
  },
});

export const enrichInspiration = mutation({
  args: {
    candidateItemId: v.id("candidateItems"),
    category: v.string(),
    description: v.string(),
    styleTags: v.array(v.string()),
    embedding: v.array(v.float64()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const candidate = await ctx.db.get(args.candidateItemId);
    if (!candidate || candidate.userId !== user.userId) throw new Error("Inspiration not found");
    const membership = await ctx.db
      .query("wardrobeMemberships")
      .withIndex("by_candidate", (q) => q.eq("candidateItemId", args.candidateItemId))
      .first();
    if (!membership || membership.userId !== user.userId) throw new Error("Collection membership not found");
    const wardrobe = await ctx.db.get(membership.wardrobeId);
    if (!wardrobe || wardrobe.userId !== user.userId) throw new Error("Collection not found");
    const { traceId, traceparent } = ensureTraceContext(args);
    await ctx.db.patch(args.candidateItemId, {
      category: args.category,
      description: args.description,
      styleTags: args.styleTags,
      embedding: args.embedding,
      status: "active",
      traceId,
      traceparent,
      updatedAt: Date.now(),
    });
    try {
      await retrier.run(ctx, internal.zepSync.syncCandidateInspiration, {
        userId: user.userId,
        user,
        candidateItemId: args.candidateItemId,
        wardrobeId: wardrobe._id,
        wardrobeName: wardrobe.name,
        wardrobeKind: wardrobe.kind,
        wardrobeStatus: wardrobe.status,
        wardrobeDescription: wardrobe.description,
        wardrobeMoodWords: wardrobe.moodWords ?? [],
        storageId: candidate.storageId,
        sourceUrl: candidate.sourceUrl,
        sourceLabel: candidate.sourceLabel,
        category: args.category,
        description: args.description,
        styleTags: args.styleTags,
        traceId,
        traceparent,
      });
    } catch (error) {
      console.warn("zep.sync.candidate_inspiration.enqueue_failed", { traceId, traceparent, candidateItemId: args.candidateItemId, message: toErrorMessage(error) });
    }
    return { success: true as const };
  },
});

export const listInspirationByWardrobe = query({
  args: { wardrobeId: v.id("wardrobes") },
  handler: async (ctx, { wardrobeId }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];
    const wardrobe = await ctx.db.get(wardrobeId);
    if (!wardrobe || wardrobe.userId !== userId) return [];
    const memberships = await ctx.db.query("wardrobeMemberships").withIndex("by_wardrobe", (q) => q.eq("wardrobeId", wardrobeId)).collect();
    const items = await Promise.all(memberships.filter((membership) => membership.candidateItemId).map(async (membership) => {
      const candidate = membership.candidateItemId ? await ctx.db.get(membership.candidateItemId) : null;
      if (!candidate || candidate.userId !== userId) return null;
      return { ...candidate, membershipId: membership._id, membershipKind: membership.membershipKind, rationale: membership.rationale ?? null, imageUrl: candidate.storageId ? await ctx.storage.getUrl(candidate.storageId) : null };
    }));
    return items.filter((item) => item !== null);
  },
});
