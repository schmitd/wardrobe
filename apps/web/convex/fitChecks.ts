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
  v.literal("transcribed_only"),
  v.literal("observed_unresolved")
);

const garmentResolutionStatus = v.union(
  v.literal("auto_matched"),
  v.literal("needs_confirmation"),
  v.literal("unresolved")
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
        observation: v.optional(v.object({
          cropStorageId: v.id("_storage"),
          categoryKey: v.string(),
          visualEmbedding: v.array(v.float64()),
          semanticEmbedding: v.optional(v.array(v.float64())),
          embeddingModel: v.string(),
          detectorModel: v.string(),
          resolutionStatus: garmentResolutionStatus,
          matchScore: v.optional(v.number()),
          matchMargin: v.optional(v.number()),
          candidateItemIds: v.array(v.id("wardrobeItems")),
          candidateScores: v.array(v.number()),
        })),
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

    if (args.type === "try_on") {
      const existing = await ctx.db
        .query("fitChecks")
        .withIndex("by_user_storage_type", (q) =>
          q.eq("userId", user.userId).eq("storageId", args.storageId).eq("type", "try_on")
        )
        .first();
      if (existing) {
        const existingItems = await ctx.db
          .query("fitCheckItems")
          .withIndex("by_fit_check", (q) => q.eq("fitCheckId", existing._id))
          .collect();
        return { id: existing._id, created: false as const, items: existingItems };
      }
    }

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
    const recordedObservations = [];
    for (const item of args.items) {
      let wardrobeItemId = item.wardrobeItemId;
      const source =
        args.type === "try_on" && item.source === "created_from_fit_check"
          ? ("transcribed_only" as const)
          : item.source;
      if (!wardrobeItemId && source === "created_from_fit_check") {
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
        source,
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
        source,
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
        boundingBox: item.boundingBox ?? null,
        confidence: item.confidence,
      });

      if (item.observation && item.boundingBox && item.category && item.description) {
        const observationId = await ctx.db.insert("garmentObservations", {
          userId: user.userId,
          fitCheckId,
          fitCheckItemId,
          cropStorageId: item.observation.cropStorageId,
          wardrobeItemId,
          category: item.category,
          categoryKey: item.observation.categoryKey,
          description: item.description,
          styleTags: item.styleTags ?? [],
          boundingBox: item.boundingBox,
          detectorConfidence: item.confidence,
          visualEmbedding: item.observation.visualEmbedding,
          semanticEmbedding: item.observation.semanticEmbedding,
          embeddingModel: item.observation.embeddingModel,
          detectorModel: item.observation.detectorModel,
          resolutionStatus: item.observation.resolutionStatus,
          matchScore: item.observation.matchScore,
          matchMargin: item.observation.matchMargin,
          candidateItemIds: item.observation.candidateItemIds,
          candidateScores: item.observation.candidateScores,
          resolvedAt: item.observation.resolutionStatus === "auto_matched" ? timestamp : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        recordedObservations.push({ id: observationId, status: item.observation.resolutionStatus });
      }
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

    return { id: fitCheckId, created: true as const, items: recordedItems, observations: recordedObservations };
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
      checks.map(async (fitCheck) => {
        const observations = await ctx.db
          .query("garmentObservations")
          .withIndex("by_fit_check", (q) => q.eq("fitCheckId", fitCheck._id))
          .collect();
        const candidateIds = [...new Set(observations.flatMap((observation) => observation.candidateItemIds))];
        const candidateItems = await Promise.all(candidateIds.map(async (itemId) => {
          const item = await ctx.db.get(itemId);
          if (!item || item.userId !== userId) return null;
          return { id: item._id, imageUrl: await ctx.storage.getUrl(item.storageId), category: item.category ?? null, description: item.description ?? null };
        }));
        const candidateMap = new Map(candidateItems.filter((item) => item !== null).map((item) => [String(item.id), item]));
        return {
          ...fitCheck,
          imageUrl: await ctx.storage.getUrl(fitCheck.storageId),
          items: await ctx.db
          .query("fitCheckItems")
          .withIndex("by_fit_check", (q) => q.eq("fitCheckId", fitCheck._id))
          .collect(),
          observations: await Promise.all(observations.map(async (observation) => ({
            ...observation,
            cropUrl: await ctx.storage.getUrl(observation.cropStorageId),
            candidates: observation.candidateItemIds.map((itemId, index) => ({
              ...(candidateMap.get(String(itemId)) ?? { id: itemId, imageUrl: null, category: null, description: null }),
              score: observation.candidateScores[index] ?? 0,
            })),
          }))),
        };
      })
    );
  },
});

export const resolveGarmentObservation = mutation({
  args: {
    observationId: v.id("garmentObservations"),
    wardrobeItemId: v.id("wardrobeItems"),
  },
  handler: async (ctx, { observationId, wardrobeItemId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const [observation, wardrobeItem] = await Promise.all([ctx.db.get(observationId), ctx.db.get(wardrobeItemId)]);
    if (!observation || observation.userId !== user.userId || !wardrobeItem || wardrobeItem.userId !== user.userId) {
      throw new Error("Not found");
    }
    const timestamp = now();
    await Promise.all([
      ctx.db.patch(observationId, { wardrobeItemId, resolutionStatus: "confirmed", resolvedAt: timestamp, updatedAt: timestamp }),
      ctx.db.patch(observation.fitCheckItemId, { wardrobeItemId, source: "matched_existing" }),
    ]);
    try {
      await retrier.run(ctx, internal.zepSync.syncGarmentIdentityResolution, {
        userId: user.userId,
        user,
        fitCheckId: observation.fitCheckId,
        wardrobeItemId,
        category: observation.category,
        description: observation.description,
        resolution: "confirmed",
        score: observation.matchScore,
        createdAt: timestamp,
      });
    } catch (error) {
      console.warn("zep.sync.garment_identity.enqueue_failed", { observationId, message: toErrorMessage(error) });
    }
    return { success: true as const, wardrobeItemId };
  },
});

export const promoteGarmentObservation = mutation({
  args: { observationId: v.id("garmentObservations") },
  handler: async (ctx, { observationId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const observation = await ctx.db.get(observationId);
    if (!observation || observation.userId !== user.userId) throw new Error("Not found");
    if (observation.wardrobeItemId) return { success: true as const, wardrobeItemId: observation.wardrobeItemId };
    const timestamp = now();
    const wardrobeItemId = await ctx.db.insert("wardrobeItems", {
      userId: user.userId,
      storageId: observation.cropStorageId,
      sourceFitCheckId: observation.fitCheckId,
      clientFileName: `fit-${observation.fitCheckId}-${observationId}.jpg`,
      contentType: "image/jpeg",
      category: observation.category,
      description: observation.description,
      styleTags: observation.styleTags,
      embedding: observation.semanticEmbedding,
      visualEmbedding: observation.visualEmbedding,
      visualEmbeddingModel: observation.embeddingModel,
      analysisStatus: "ready",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await Promise.all([
      ctx.db.patch(observationId, { wardrobeItemId, resolutionStatus: "promoted_new", resolvedAt: timestamp, updatedAt: timestamp }),
      ctx.db.patch(observation.fitCheckItemId, { wardrobeItemId, source: "created_from_fit_check" }),
    ]);
    try {
      await retrier.run(ctx, internal.zepSync.syncGarmentIdentityResolution, {
        userId: user.userId,
        user,
        fitCheckId: observation.fitCheckId,
        wardrobeItemId,
        category: observation.category,
        description: observation.description,
        resolution: "promoted_new",
        score: observation.matchScore,
        createdAt: timestamp,
      });
    } catch (error) {
      console.warn("zep.sync.garment_identity.enqueue_failed", { observationId, message: toErrorMessage(error) });
    }
    return { success: true as const, wardrobeItemId };
  },
});
