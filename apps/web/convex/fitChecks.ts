import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";

const now = () => Date.now();

const fitCheckType = v.union(
  v.literal("daily_fit_check"),
  v.literal("try_on"),
  v.literal("candidate_fit_check")
);

const detectedItemSource = v.union(
  v.literal("matched_existing"),
  v.literal("created_from_fit_check"),
  v.literal("transcribed_only")
);

const boundingBox = v.optional(
  v.object({
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
  })
);

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const recordFitCheck = mutation({
  args: {
    storageId: v.id("_storage"),
    type: fitCheckType,
    description: v.optional(v.string()),
    transcription: v.optional(v.string()),
    items: v.array(
      v.object({
        wardrobeItemId: v.optional(v.id("wardrobeItems")),
        source: detectedItemSource,
        category: v.optional(v.union(v.string(), v.null())),
        description: v.optional(v.union(v.string(), v.null())),
        styleTags: v.optional(v.union(v.array(v.string()), v.null())),
        boundingBox,
        confidence: v.optional(v.number()),
        embedding: v.optional(v.array(v.float64())),
      })
    ),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const { traceId, traceparent } = ensureTraceContext(args);

    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_user_storage", (q) =>
        q.eq("userId", user.userId).eq("storageId", args.storageId)
      )
      .first();
    if (!upload) throw new Error("Upload not registered");

    const timestamp = now();
    const fitCheckId = await ctx.db.insert("fitChecks", {
      userId: user.userId,
      storageId: args.storageId,
      type: args.type,
      description: args.description,
      transcription: args.transcription,
      traceId,
      traceparent,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const recordedItems = [];
    for (const item of args.items) {
      let wardrobeItemId = item.wardrobeItemId;
      if (!wardrobeItemId && item.source === "created_from_fit_check") {
        wardrobeItemId = await ctx.db.insert("wardrobeItems", {
          userId: user.userId,
          storageId: args.storageId,
          sourceFitCheckId: fitCheckId,
          category: item.category ?? undefined,
          description: item.description ?? undefined,
          styleTags: item.styleTags ?? undefined,
          embedding: item.embedding,
          analysisStatus: item.embedding ? "ready" : "queued",
          traceId,
          traceparent,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      const fitCheckItemId = await ctx.db.insert("fitCheckItems", {
        userId: user.userId,
        fitCheckId,
        wardrobeItemId,
        source: item.source,
        category: item.category ?? undefined,
        description: item.description ?? undefined,
        styleTags: item.styleTags ?? undefined,
        boundingBox: item.boundingBox,
        confidence: item.confidence,
        createdAt: timestamp,
      });

      recordedItems.push({
        id: fitCheckItemId,
        wardrobeItemId,
        source: item.source,
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
        boundingBox: item.boundingBox ?? null,
        confidence: item.confidence,
      });
    }

    try {
      await retrier.run(ctx, internal.zepSync.syncFitCheck, {
        userId: user.userId,
        user,
        fitCheckId,
        type: args.type,
        storageId: args.storageId,
        createdAt: timestamp,
        items: recordedItems.map((item) => ({
          source: item.source,
          category: item.category,
          description: item.description,
          styleTags: item.styleTags,
          ...(item.wardrobeItemId ? { wardrobeItemId: item.wardrobeItemId } : {}),
          ...(item.boundingBox ? { boundingBox: item.boundingBox } : {}),
          ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
        })),
        ...(args.description ? { description: args.description } : {}),
        ...(args.transcription ? { transcription: args.transcription } : {}),
        traceId,
        traceparent,
      });
    } catch (error) {
      console.warn("zep.sync.fit_check.enqueue_failed", {
        traceId,
        traceparent,
        userId: user.userId,
        fitCheckId,
        message: toErrorMessage(error),
      });
    }

    return { id: fitCheckId, items: recordedItems };
  },
});

export const listFitChecks = query({
  args: {
    type: v.optional(fitCheckType),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { type, limit }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];

    const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit ?? 30)));
    const checks = type
      ? await ctx.db
          .query("fitChecks")
          .withIndex("by_user_type_createdAt", (q) => q.eq("userId", userId).eq("type", type))
          .order("desc")
          .take(cappedLimit)
      : await ctx.db
          .query("fitChecks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(cappedLimit);

    return Promise.all(
      checks.map(async (fitCheck) => ({
        ...fitCheck,
        imageUrl: await ctx.storage.getUrl(fitCheck.storageId),
        items: await ctx.db
          .query("fitCheckItems")
          .withIndex("by_fit_check", (q) => q.eq("fitCheckId", fitCheck._id))
          .collect(),
      }))
    );
  },
});
