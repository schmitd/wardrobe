"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { ensureTraceContext } from "./trace";
import {
  addInspirationMemory,
  addTryOnMemory,
  addWardrobeItemsMemory,
  deleteWardrobeItemMemory,
  searchStyleMemory,
  updateProfileMemory,
} from "./zep";

const redactUserId = (userId: string) =>
  userId.length <= 8 ? "[redacted]" : `${userId.slice(0, 4)}...${userId.slice(-4)}`;

export const syncWardrobeAdd = internalAction({
  args: {
    userId: v.string(),
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
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
      },
    ]);

    return { skipped: false as const };
  },
});

export const syncWardrobeDelete = internalAction({
  args: {
    userId: v.string(),
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

    await deleteWardrobeItemMemory(args.userId, args.description, args.reason);
  },
});

export const syncProfileUpdate = internalAction({
  args: {
    userId: v.string(),
    bio: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    hairColor: v.optional(v.string()),
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
      skinTone: args.skinTone ?? null,
      hairColor: args.hairColor ?? null,
    });
  },
});

export const syncInspirationAdd = internalAction({
  args: {
    userId: v.string(),
    inspirationId: v.id("inspirations"),
    sourceUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId } = ensureTraceContext(args);
    console.info("zep.sync.inspiration_add", {
      traceId,
      userId: redactUserId(args.userId),
      inspirationId: args.inspirationId,
    });

    await addInspirationMemory(args.userId, {
      inspirationId: String(args.inspirationId),
      sourceUrl: args.sourceUrl ?? null,
      note: args.note ?? null,
      category: args.category ?? null,
      description: args.description ?? null,
      styleTags: args.styleTags ?? null,
    });
  },
});

export const recordTryOn = internalAction({
  args: {
    userId: v.string(),
    category: v.string(),
    description: v.string(),
    styleTags: v.array(v.string()),
    score: v.number(),
    verdict: v.optional(v.string()),
    explanation: v.string(),
    closetAnchors: v.array(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { traceId } = ensureTraceContext(args);
    console.info("zep.sync.try_on", {
      traceId,
      userId: redactUserId(args.userId),
      score: args.score,
    });
    await addTryOnMemory(args.userId, args);
  },
});

export const searchContext = internalAction({
  args: {
    userId: v.string(),
    query: v.string(),
  },
  handler: async (_ctx, args) => searchStyleMemory(args.userId, args.query),
});
