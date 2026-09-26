import { scheduleStyleBioRefresh } from "../styleBioQueue";
import { recordPhotoWear } from "../wearDomain";
import { validateWearDate } from "@wardrobe/shared";
import { ownedStorageUrl, requireOwnedStorage } from "../storageAccess";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../../convex/_generated/api";
import { mutation, query } from "../../convex/_generated/server";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { QueryCtx } from "../../convex/_generated/server";

const requireOwnedItem = async (ctx: QueryCtx, userId: string, id: Id<"wardrobeItems">) => {
  const item = await ctx.db.get(id);
  if (!item || item.userId !== userId) throw new Error("Item not found");
  await requireOwnedStorage(ctx, userId, item.storageId);
};
const requireObservationParents = async (ctx: QueryCtx, userId: string, observation: { fitCheckId: Id<"fitChecks">; fitCheckItemId: Id<"fitCheckItems"> }) => {
  const [fit, item] = await Promise.all([ctx.db.get(observation.fitCheckId), ctx.db.get(observation.fitCheckItemId)]);
  if (!fit || fit.userId !== userId || !item || item.userId !== userId || item.fitCheckId !== fit._id) throw new Error("Fit not found");
};

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
    localDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
    capturedAt: v.optional(v.number()),
    planId: v.optional(v.id("outfitSuggestions")),
    expectedPlanRevision: v.optional(v.number()),
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
    if (args.items.length > 30 || args.items.some(item => (item.observation?.candidateItemIds.length ?? 0) > 10 || (item.observation?.visualEmbedding.length ?? 0) > 768 || (item.observation?.semanticEmbedding?.length ?? 0) > 768)) throw new ConvexError({ _tag: "InvalidInput", message: "This fit contains too many pieces. Try a simpler photo." });
    const { traceId, traceparent } = ensureTraceContext(args);
    validateWearDate(args.localDate, args.timezone);
    if (args.capturedAt !== undefined && (!Number.isFinite(args.capturedAt) || args.capturedAt < 0 || args.capturedAt > Date.now() + 60_000)) throw new Error("Invalid capture time");
    await requireOwnedStorage(ctx, user.userId, args.storageId);
    for (const item of args.items) {
      if (item.wardrobeItemId) await requireOwnedItem(ctx, user.userId, item.wardrobeItemId);
      if (item.observation) {
        await requireOwnedStorage(ctx, user.userId, item.observation.cropStorageId);
        for (const candidateId of item.observation.candidateItemIds) await requireOwnedItem(ctx, user.userId, candidateId);
      }
    }

    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_user_storage", (q) =>
        q.eq("userId", user.userId).eq("storageId", args.storageId)
      )
      .first();
    if (!upload) throw new Error("Upload not registered");

    {
      const existing = await ctx.db
        .query("fitChecks")
        .withIndex("by_user_storage_type", (q) =>
          q.eq("userId", user.userId).eq("storageId", args.storageId).eq("type", args.type)
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
      localDate: args.localDate,
      timezone: args.timezone,
      capturedAt: args.capturedAt,
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

    await recordPhotoWear(ctx, fitCheckId, { planId: args.planId, expectedPlanRevision: args.expectedPlanRevision });
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

    await scheduleStyleBioRefresh(ctx, user.userId);
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

    const cappedLimit = Math.max(1, Math.min(30, Math.floor(limit ?? 30)));
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

    return projectFitChecks(ctx, userId, checks);
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
    await requireObservationParents(ctx, user.userId, observation);
    await requireOwnedStorage(ctx, user.userId, observation.cropStorageId);
    await requireOwnedStorage(ctx, user.userId, wardrobeItem.storageId);
    const timestamp = now();
    await Promise.all([
      ctx.db.patch(observationId, { wardrobeItemId, resolutionStatus: "confirmed", resolvedAt: timestamp, updatedAt: timestamp }),
      ctx.db.patch(observation.fitCheckItemId, { wardrobeItemId, source: "matched_existing" }),
    ]);
    await recordPhotoWear(ctx, observation.fitCheckId);
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
    await scheduleStyleBioRefresh(ctx, user.userId);
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
    await requireObservationParents(ctx, user.userId, observation);
    await requireOwnedStorage(ctx, user.userId, observation.cropStorageId);
    if (observation.wardrobeItemId) {
      await requireOwnedItem(ctx, user.userId, observation.wardrobeItemId);
      return { success: true as const, wardrobeItemId: observation.wardrobeItemId };
    }
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
    await recordPhotoWear(ctx, observation.fitCheckId);
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
    await scheduleStyleBioRefresh(ctx, user.userId);
    return { success: true as const, wardrobeItemId };
  },
});

export async function projectFitChecks(ctx: QueryCtx, userId: string, checks: Doc<"fitChecks">[]) {
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
          return { id: item._id, imageUrl: await ownedStorageUrl(ctx, userId, item.storageId), category: item.category ?? null, description: item.description ?? null };
        }));
        const candidateMap = new Map(candidateItems.filter((item) => item !== null).map((item) => [String(item.id), item]));
        return {
          ...fitCheck,
          imageUrl: await ownedStorageUrl(ctx, userId, fitCheck.storageId),
          items: await ctx.db
          .query("fitCheckItems")
          .withIndex("by_fit_check", (q) => q.eq("fitCheckId", fitCheck._id))
          .collect(),
          observations: await Promise.all(observations.map(async (observation) => ({
            _id: observation._id,
            category: observation.category,
            description: observation.description,
            resolutionStatus: observation.resolutionStatus,
            wardrobeItemId: observation.wardrobeItemId,
            boundingBox: observation.boundingBox,
            matchScore: observation.matchScore,
            cropUrl: await ownedStorageUrl(ctx, userId, observation.cropStorageId),
            candidates: observation.candidateItemIds.map((itemId, index) => ({
              ...(candidateMap.get(String(itemId)) ?? { id: itemId, imageUrl: null, category: null, description: null }),
              score: observation.candidateScores[index] ?? 0,
            })),
          }))),
        };
      })
    );
}

export const pageFitChecks = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db.query("fitChecks").withIndex("by_user", q => q.eq("userId", userId)).order("desc").paginate({ ...paginationOpts, numItems: Math.max(1, Math.min(20, paginationOpts.numItems)), maximumRowsRead: 20 });
    return { ...result, page: await projectFitChecks(ctx, userId, result.page) };
  },
});

export const exportImage = query({
  args: { id: v.id("fitChecks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthenticatedUserId(ctx);
    const fit = await ctx.db.get(id);
    if (!userId || fit?.userId !== userId) return null;
    const imageUrl = await ownedStorageUrl(ctx, userId, fit.storageId);
    return imageUrl ? { imageUrl, revision: fit.updatedAt } : null;
  },
});
