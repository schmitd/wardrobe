import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ensureTraceContext } from "./trace";
import { retrier } from "./retrier";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";

const now = () => Date.now();
const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const DEFAULT_SIMILARITY_LIMIT = 200;
const MAX_SIMILARITY_LIMIT = 200;
const SIMILARITY_SCAN_BATCH_SIZE = 64;

const garmentCategoryKey = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (/shirt|blouse|sweater|cardigan|hoodie|tee|t-shirt|tank|top/.test(normalized)) return "top";
  if (/pants|trouser|jeans|skirt|shorts|legging|bottom/.test(normalized)) return "bottom";
  if (/jacket|coat|blazer|parka|outerwear/.test(normalized)) return "outerwear";
  if (/shoe|boot|sneaker|loafer|sandal|heel|footwear/.test(normalized)) return "footwear";
  if (/dress|jumpsuit|romper/.test(normalized)) return "one_piece";
  if (/bag|purse|tote|backpack/.test(normalized)) return "bag";
  if (/jewel|watch|belt|hat|scarf|accessory/.test(normalized)) return "accessory";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
};

const getGarmentObservationsRef = makeFunctionReference<
  "query",
  { observationIds: Id<"garmentObservations">[] },
  Array<Doc<"garmentObservations"> | null>
>("garmentIdentityQueries:getGarmentObservations");

type VisualCandidateDetail = {
  id: Id<"wardrobeItems">;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
};

const getVisualCandidateDetailsRef = makeFunctionReference<
  "query",
  { itemIds: Id<"wardrobeItems">[] },
  VisualCandidateDetail[]
>("garmentIdentityQueries:getVisualCandidateDetails");

const normalizeSimilarityLimit = (limit?: number) => {
  const fallback = DEFAULT_SIMILARITY_LIMIT;
  if (limit === undefined) return fallback;
  if (!Number.isFinite(limit)) return fallback;

  const rounded = Math.floor(limit);
  if (rounded < 1) return 1;
  if (rounded > MAX_SIMILARITY_LIMIT) return MAX_SIMILARITY_LIMIT;
  return rounded;
};

const getOwnedItem = async (
  ctx: {
    db: { get: (id: Id<"wardrobeItems">) => Promise<{ userId: string } | null> };
    auth: { getUserIdentity: () => Promise<({ subject: string } & Record<string, unknown>) | null> };
  },
  itemId: Id<"wardrobeItems">
) => {
  const userId = await getAuthenticatedUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) throw new Error("Not found");

  return { userId, item };
};

export const listWardrobeItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
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
    const userId = await getAuthenticatedUserId(ctx);
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
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;

    const { traceId, traceparent } = ensureTraceContext({
      traceId: args.traceId,
      traceparent: args.traceparent,
    });
    const existing = await ctx.db
      .query("wardrobeItems")
      .withIndex("by_user_storage", (q) =>
        q.eq("userId", userId).eq("storageId", args.storageId)
      )
      .first();
    if (existing) {
      console.info("wardrobe.create_reused", {
        traceId,
        traceparent,
        itemId: existing._id,
        userId,
      });
      return {
        id: existing._id,
        created: false as const,
        analysisStatus: existing.analysisStatus,
      };
    }

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

    return { id: itemId, created: true as const, analysisStatus: "queued" as const };
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
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;

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
        user,
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
    const userId = await getAuthenticatedUserId(ctx);
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

export const getWardrobeItemsDisplayByIds = query({
  args: {
    itemIds: v.array(v.id("wardrobeItems")),
  },
  handler: async (ctx, { itemIds }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const uniqueIds = [...new Set(itemIds)];
    const items = await Promise.all(
      uniqueIds.map(async (itemId) => {
        const item = await ctx.db.get(itemId);
        if (!item || item.userId !== userId) {
          return null;
        }

        const imageUrl = await ctx.storage.getUrl(item.storageId);
        if (!imageUrl) {
          return null;
        }

        return {
          id: item._id,
          imageUrl,
          category: item.category ?? null,
          description: item.description ?? null,
          styleTags: item.styleTags ?? null,
          analysisStatus: item.analysisStatus,
          analysisError: item.analysisError ?? null,
          createdAt: item.createdAt,
        };
      })
    );

    return items.filter((item) => item !== null);
  },
});

export const searchSimilarItems = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { embedding, limit }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const results = await ctx.vectorSearch("wardrobeItems", "by_embedding", {
      vector: embedding,
      limit: normalizeSimilarityLimit(limit),
      filter: (q) => q.eq("userId", userId),
    });

    return results;
  },
});

export const searchGarmentIdentityCandidates = action({
  args: {
    visualEmbedding: v.array(v.float64()),
    categoryKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { visualEmbedding, categoryKey, limit }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const candidateLimit = Math.max(3, Math.min(12, Math.floor(limit ?? 5)));

    const [canonical, observationResults] = await Promise.all([
      ctx.vectorSearch("wardrobeItems", "by_visual_embedding", {
        vector: visualEmbedding,
        limit: Math.min(40, candidateLimit * 6),
        filter: (q) => q.eq("userId", userId),
      }),
      ctx.vectorSearch("garmentObservations", "by_visual_embedding", {
        vector: visualEmbedding,
        limit: Math.min(40, candidateLimit * 6),
        filter: (q) => q.eq("userId", userId),
      }),
    ]);

    const observationIds = observationResults.map((result) => result._id);
    const observations = await ctx.runQuery(getGarmentObservationsRef, { observationIds });
    const scoreByItem = new Map<string, number>();
    for (const result of canonical) scoreByItem.set(String(result._id), result._score);
    observationResults.forEach((result, index) => {
      const observation = observations[index];
      if (!observation?.wardrobeItemId || observation.categoryKey !== categoryKey || !["confirmed", "auto_matched", "promoted_new"].includes(observation.resolutionStatus)) return;
      const key = String(observation.wardrobeItemId);
      scoreByItem.set(key, Math.max(scoreByItem.get(key) ?? -1, result._score));
    });

    const ranked = [...scoreByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([itemId, score]) => ({ itemId: itemId as Id<"wardrobeItems">, score }));
    const details = await ctx.runQuery(getVisualCandidateDetailsRef, {
      itemIds: ranked.map((candidate) => candidate.itemId),
    });
    const detailMap = new Map(details.map((detail) => [String(detail.id), detail]));

    return ranked.flatMap((candidate) => {
      const detail = detailMap.get(String(candidate.itemId));
      if (!detail) return [];
      if (garmentCategoryKey(detail.category) !== categoryKey) return [];
      return [{ wardrobeItemId: candidate.itemId, score: candidate.score, ...detail }];
    }).slice(0, candidateLimit);
  },
});

export const listItemsForSimilarity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const targetCount = normalizeSimilarityLimit(limit);
    let cursor: string | null = null;
    const withEmbeddings = [];

    while (withEmbeddings.length < targetCount) {
      const page = await ctx.db
        .query("wardrobeItems")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .paginate({
          cursor,
          numItems: SIMILARITY_SCAN_BATCH_SIZE,
        });

      withEmbeddings.push(...page.page.filter((item) => Array.isArray(item.embedding)));

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }

    return withEmbeddings.slice(0, targetCount);
  },
});

export const listItemsMissingVisualEmbedding = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const requested = Math.max(1, Math.min(20, Math.floor(limit ?? 12)));
    const items = await ctx.db
      .query("wardrobeItems")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return Promise.all(items.filter((item) => !item.visualEmbedding).slice(0, requested).map(async (item) => ({
      id: item._id,
      imageUrl: await ctx.storage.getUrl(item.storageId),
      contentType: item.contentType ?? "image/jpeg",
      category: item.category ?? null,
      description: item.description ?? null,
      styleTags: item.styleTags ?? [],
    })));
  },
});

export const applyVisualEmbedding = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    visualEmbedding: v.array(v.float64()),
    model: v.string(),
  },
  handler: async (ctx, { itemId, visualEmbedding, model }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(itemId, { visualEmbedding, visualEmbeddingModel: model, updatedAt: now() });
    return { success: true as const };
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
    const userId = await getAuthenticatedUserId(ctx);
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
    const userId = await getAuthenticatedUserId(ctx);
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
    const userId = await getAuthenticatedUserId(ctx);
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
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { itemId, embedding }) => {
    const userId = await getAuthenticatedUserId(ctx);
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
    embedding: v.array(v.float64()),
    visualEmbedding: v.optional(v.array(v.float64())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, category, description, styleTags, embedding, visualEmbedding, traceId: argTraceId, traceparent: argTraceparent }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) {
      console.info("wardrobe.apply_full_analysis.skipped_missing_item", { itemId, userId });
      return { skipped: true as const };
    }

    const { traceId, traceparent } = ensureTraceContext({
      traceId: argTraceId ?? item.traceId,
      traceparent: argTraceparent ?? item.traceparent,
    });

    await ctx.db.patch(itemId, {
      category: category ?? undefined,
      description,
      styleTags,
      embedding,
      visualEmbedding,
      visualEmbeddingModel: visualEmbedding ? "gemini-embedding-2@768" : undefined,
      analysisStatus: "ready",
      analysisError: undefined,
      updatedAt: now(),
    });

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncWardrobeAdd, {
        userId,
        user,
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

    return { skipped: false as const };
  },
});

export const setAnalysisError = mutation({
  args: {
    itemId: v.id("wardrobeItems"),
    error: v.string(),
  },
  handler: async (ctx, { itemId, error }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) {
      console.info("wardrobe.set_analysis_error.skipped_missing_item", { itemId, userId, error });
      return { skipped: true as const };
    }

    await ctx.db.patch(itemId, {
      analysisStatus: "error",
      analysisError: error,
      updatedAt: now(),
    });

    return { skipped: false as const };
  },
});
