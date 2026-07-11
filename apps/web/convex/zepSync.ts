"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { ensureTraceContext } from "./trace";
import { getAuthenticatedUser } from "./authIdentity";
import {
  addCandidateComparisonMemory,
  addCandidateInspirationMemory,
  addFitCheckMemory,
  addWardrobeCollectionMemory,
  addWardrobeItemsMemory,
  deleteUserMemory,
  deleteWardrobeItemMemory,
  ensureWardrobeZepProject,
  searchStyleBioGraphContext,
  searchWardrobeStyleMemory,
  updateProfileMemory,
} from "./zep";

const zepUser = v.optional(
  v.object({
    userId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
  })
);

const zepWardrobeItem = v.object({
  itemId: v.optional(v.string()),
  category: v.optional(v.union(v.string(), v.null())),
  description: v.optional(v.union(v.string(), v.null())),
  styleTags: v.optional(v.union(v.array(v.string()), v.null())),
});

const zepBoundingBox = v.optional(
  v.object({
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
  })
);

const redactUserId = (userId: string) =>
  userId.length <= 8 ? "[redacted]" : `${userId.slice(0, 4)}...${userId.slice(-4)}`;

export const bootstrapProject = internalAction({
  args: {},
  handler: async () => {
    await ensureWardrobeZepProject();
    return { ok: true as const };
  },
});

export const syncWardrobeAdd = internalAction({
  args: {
    userId: v.string(),
    user: zepUser,
    itemId: v.id("wardrobeItems"),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.wardrobe_add", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
      itemId: args.itemId,
    });

    const item = await ctx.runQuery(internal.wardrobe.getWardrobeItemInternal, {
      itemId: args.itemId,
    });

    if (!item) {
      console.info("zep.sync.wardrobe_add.skipped_missing_item", {
        traceId,
        traceparent,
        userId: redactUserId(args.userId),
        itemId: args.itemId,
      });
      return { skipped: true as const };
    }

    await addWardrobeItemsMemory(args.userId, [
      {
        itemId: args.itemId,
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
        wardrobeId: item.wardrobeId ?? null,
        sourceFitCheckId: item.sourceFitCheckId ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    ], args.user);

    return { skipped: false as const };
  },
});

export const syncWardrobeDelete = internalAction({
  args: {
    userId: v.string(),
    user: zepUser,
    description: v.string(),
    reason: v.string(),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.wardrobe_delete", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
      reason: args.reason,
    });

    await deleteWardrobeItemMemory(args.userId, args.description, args.reason, args.user);
  },
});

export const syncProfileUpdate = internalAction({
  args: {
    userId: v.string(),
    user: zepUser,
    bio: v.optional(v.string()),
    bioSource: v.optional(v.string()),
    bioRevisionId: v.optional(v.string()),
    previousBioRevisionId: v.optional(v.string()),
    updateReason: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.profile_update", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
    });

    await updateProfileMemory(args.userId, {
      bio: args.bio ?? null,
      bioSource: args.bioSource ?? null,
      bioRevisionId: args.bioRevisionId ?? null,
      previousBioRevisionId: args.previousBioRevisionId ?? null,
      updateReason: args.updateReason ?? null,
      skinTone: args.skinTone ?? null,
      complexion: args.complexion ?? null,
      hairColor: args.hairColor ?? null,
      colorSeason: args.colorSeason ?? null,
    }, args.user);
  },
});

export const getStyleBioGraphContext = action({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    try {
      return await searchStyleBioGraphContext(user.userId);
    } catch (error) {
      console.warn("zep.style_bio_context.failed", {
        userId: redactUserId(user.userId),
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
});

export const syncWardrobeCollection = internalAction({
  args: {
    userId: v.string(),
    user: zepUser,
    wardrobeId: v.string(),
    name: v.string(),
    kind: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    moodWords: v.optional(v.array(v.string())),
    item: v.optional(zepWardrobeItem),
    membershipKind: v.optional(v.string()),
    rationale: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.wardrobe_collection", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
      wardrobeId: args.wardrobeId,
    });

    await addWardrobeCollectionMemory(args.userId, {
      wardrobeId: args.wardrobeId,
      name: args.name,
      kind: args.kind,
      description: args.description ?? null,
      status: args.status,
      moodWords: args.moodWords ?? [],
      item: args.item,
      membershipKind: args.membershipKind,
      rationale: args.rationale,
    }, args.user);
  },
});

export const syncFitCheck = internalAction({
  args: {
    userId: v.string(),
    user: zepUser,
    fitCheckId: v.string(),
    type: v.union(
      v.literal("daily_fit_check"),
      v.literal("try_on"),
      v.literal("candidate_fit_check")
    ),
    description: v.optional(v.string()),
    transcription: v.optional(v.string()),
    storageId: v.string(),
    createdAt: v.number(),
    items: v.array(
      v.object({
        wardrobeItemId: v.optional(v.string()),
        source: v.union(
          v.literal("matched_existing"),
          v.literal("created_from_fit_check"),
          v.literal("transcribed_only")
        ),
        category: v.optional(v.union(v.string(), v.null())),
        description: v.optional(v.union(v.string(), v.null())),
        styleTags: v.optional(v.union(v.array(v.string()), v.null())),
        boundingBox: zepBoundingBox,
        confidence: v.optional(v.number()),
      })
    ),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.fit_check", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
      fitCheckId: args.fitCheckId,
      type: args.type,
      itemCount: args.items.length,
    });

    await addFitCheckMemory(args.userId, {
      fitCheckId: args.fitCheckId,
      type: args.type,
      description: args.description ?? null,
      transcription: args.transcription ?? null,
      storageId: args.storageId,
      createdAt: args.createdAt,
      items: args.items,
    }, args.user);
  },
});

export const syncCandidateComparison = action({
  args: {
    candidate: zepWardrobeItem,
    storageId: v.optional(v.string()),
    evaluation: v.optional(
      v.union(
        v.null(),
        v.object({
          score: v.number(),
          explanation: v.string(),
          best_pairings: v.array(v.number()),
          worst_clashes: v.array(v.number()),
        })
      )
    ),
    similarItems: v.array(zepWardrobeItem),
    dissimilarItems: v.array(zepWardrobeItem),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.candidate_comparison", {
      traceId,
      traceparent,
      userId: redactUserId(user.userId),
    });

    await addCandidateComparisonMemory(user.userId, {
      candidate: args.candidate,
      storageId: args.storageId,
      evaluation: args.evaluation ?? null,
      similarItems: args.similarItems,
      dissimilarItems: args.dissimilarItems,
    }, user);
  },
});

export const searchStyleContext = action({
  args: { query: v.string(), traceId: v.optional(v.string()), traceparent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    return searchWardrobeStyleMemory(user.userId, args.query, user);
  },
});

export const syncCandidateInspiration = internalAction({
  args: {
    userId: v.string(), user: zepUser, candidateItemId: v.id("candidateItems"),
    wardrobeId: v.id("wardrobes"), wardrobeName: v.string(), wardrobeKind: v.string(),
    wardrobeStatus: v.string(), wardrobeDescription: v.optional(v.string()),
    wardrobeMoodWords: v.array(v.string()), storageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()), sourceLabel: v.optional(v.string()),
    category: v.optional(v.string()), description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())), traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    await addCandidateInspirationMemory(args.userId, {
      candidate: { itemId: args.candidateItemId, category: args.category ?? null, description: args.description ?? null, styleTags: args.styleTags ?? null, sourceUrl: args.sourceUrl ?? null, sourceLabel: args.sourceLabel ?? null },
      storageId: args.storageId ?? null,
      collection: { wardrobeId: args.wardrobeId, name: args.wardrobeName, kind: args.wardrobeKind, description: args.wardrobeDescription ?? null, status: args.wardrobeStatus, moodWords: args.wardrobeMoodWords },
    }, args.user);
  },
});

export const deleteUserGraph = internalAction({
  args: {
    userId: v.string(),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId, traceparent } = ensureTraceContext(args);
    console.info("zep.sync.user_delete", {
      traceId,
      traceparent,
      userId: redactUserId(args.userId),
    });

    return deleteUserMemory(args.userId);
  },
});
