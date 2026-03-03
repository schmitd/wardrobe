import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ensureTraceContext } from "./trace";
import { retrier } from "./retrier";

const now = () => Date.now();
const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getUserId = async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

const getOwnedItem = async (
  ctx: {
    db: { get: (id: Id<"wardrobeItems">) => Promise<{ userId: string } | null> };
    auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  },
  itemId: Id<"wardrobeItems">
) => {
  const userId = await getUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) throw new Error("Not found");

  return { userId, item };
};

export const listWardrobeItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("wardrobeItems")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const withUrls = await Promise.all(
      items.map(async (item) => ({
        id: item._id,
        imageUrl: await ctx.storage.getUrl(item.storageId),
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
        analysisStatus: item.analysisStatus,
        analysisError: item.analysisError ?? null,
        createdAt: item.createdAt,
      }))
    );

    return withUrls.filter((item) => item.imageUrl !== null);
  },
});

export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return ctx.storage.generateUploadUrl();
  },
});

export const createWardrobeItem = mutation({
  args: {
    storageId: v.id("_storage"),
    clientFileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const { traceId, traceparent } = ensureTraceContext({
      traceId: args.traceId,
      traceparent: args.traceparent,
    });
    const timestamp = now();
    const itemId = await ctx.db.insert("wardrobeItems", {
      userId,
      storageId: args.storageId,
      clientFileName: args.clientFileName,
      contentType: args.contentType,
      analysisStatus: "queued",
      traceId,
      traceparent,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    console.info("wardrobe.create", { traceId, traceparent, itemId, userId });

    return { id: itemId };
  },
});

export const deleteWardrobeItem = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    reason: v.string(),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, reason, traceId: argTraceId, traceparent: argTraceparent }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    const { traceId, traceparent } = ensureTraceContext({
      traceId: argTraceId ?? item.traceId,
      traceparent: argTraceparent ?? item.traceparent,
    });

    await ctx.db.delete(itemId);
    const description = item.description ?? item.category ?? "Unknown item";

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncWardrobeDelete, {
        userId,
        description,
        reason,
        traceId,
        traceparent,
      });
      console.info("zep.sync.wardrobe_delete.enqueued", {
        traceId,
        traceparent,
        itemId,
        userId,
        runId,
      });
    } catch (error) {
      console.warn("zep.sync.wardrobe_delete.enqueue_failed", {
        traceId,
        traceparent,
        itemId,
        userId,
        message: toErrorMessage(error),
      });
    }

    console.info("wardrobe.delete", { traceId, traceparent, itemId, userId, reason });

    return { success: true };
  },
});

export const getWardrobeItem = query({
  args: {
    itemId: v.id("wardrobeItems"),
  },
  handler: async (ctx, { itemId }) => {
    const { item } = await getOwnedItem(ctx, itemId);
    return item;
  },
});

export const getWardrobeItemInternal = internalQuery({
  args: {
    itemId: v.id("wardrobeItems"),
  },
  handler: async (ctx, { itemId }) => {
    return ctx.db.get(itemId);
  },
});

export const getWardrobeItemWithUrl = query({
  args: {
    itemId: v.id("wardrobeItems"),
  },
  handler: async (ctx, { itemId }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }

    const imageUrl = await ctx.storage.getUrl(item.storageId);
    if (!imageUrl) {
      throw new Error("Image not available");
    }

    return {
      ...item,
      imageUrl,
    };
  },
});

export const listItemsForSimilarity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const items = await ctx.db
      .query("wardrobeItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return items
      .filter((item) => Array.isArray(item.embedding))
      .slice(0, limit ?? 200);
  },
});

export const setAnalysisStatus = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing_tags"),
      v.literal("processing_description"),
      v.literal("processing_embedding"),
      v.literal("ready"),
      v.literal("error")
    ),
  },
  handler: async (ctx, { itemId, status }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(itemId, {
      analysisStatus: status,
      updatedAt: now(),
    });
  },
});

export const applyTags = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    category: v.optional(v.union(v.string(), v.null())),
    styleTags: v.array(v.string()),
  },
  handler: async (ctx, { itemId, category, styleTags }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(itemId, {
      category: category ?? undefined,
      styleTags,
      updatedAt: now(),
    });
  },
});

export const applyDescription = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    category: v.optional(v.union(v.string(), v.null())),
    description: v.string(),
  },
  handler: async (ctx, { itemId, category, description }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(itemId, {
      category: category ?? undefined,
      description,
      updatedAt: now(),
    });
  },
});

export const applyEmbedding = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, { itemId, embedding }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(itemId, {
      embedding,
      updatedAt: now(),
    });
  },
});

export const applyFullAnalysis = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    category: v.optional(v.union(v.string(), v.null())),
    description: v.string(),
    styleTags: v.array(v.string()),
    embedding: v.array(v.number()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, category, description, styleTags, embedding, traceId: argTraceId, traceparent: argTraceparent }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    const { traceId, traceparent } = ensureTraceContext({
      traceId: argTraceId ?? item.traceId,
      traceparent: argTraceparent ?? item.traceparent,
    });

    await ctx.db.patch(itemId, {
      category: category ?? undefined,
      description,
      styleTags,
      embedding,
      analysisStatus: "ready",
      analysisError: undefined,
      updatedAt: now(),
    });

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncWardrobeAdd, {
        userId,
        itemId,
        traceId,
        traceparent,
      });
      console.info("zep.sync.wardrobe_add.enqueued", {
        traceId,
        traceparent,
        itemId,
        userId,
        runId,
      });
    } catch (error) {
      console.warn("zep.sync.wardrobe_add.enqueue_failed", {
        traceId,
        traceparent,
        itemId,
        userId,
        message: toErrorMessage(error),
      });
    }
  },
});

export const setAnalysisError = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    error: v.string(),
  },
  handler: async (ctx, { itemId, error }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(itemId, {
      analysisStatus: "error",
      analysisError: error,
      updatedAt: now(),
    });
  },
});
