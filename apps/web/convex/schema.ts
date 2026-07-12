import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const analysisStatus = v.union(
  v.literal("queued"),
  v.literal("processing_tags"),
  v.literal("processing_description"),
  v.literal("processing_embedding"),
  v.literal("ready"),
  v.literal("error")
);

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
  v.literal("confirmed"),
  v.literal("unresolved"),
  v.literal("promoted_new"),
  v.literal("rejected")
);

export default defineSchema({
  wardrobeItems: defineTable({
    userId: v.string(),
    storageId: v.id("_storage"),
    wardrobeId: v.optional(v.id("wardrobes")),
    sourceFitCheckId: v.optional(v.id("fitChecks")),
    clientFileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
    visualEmbedding: v.optional(v.array(v.float64())),
    visualEmbeddingModel: v.optional(v.string()),
    analysisStatus,
    analysisError: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_wardrobe", ["userId", "wardrobeId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userId"],
    })
    .vectorIndex("by_visual_embedding", {
      vectorField: "visualEmbedding",
      dimensions: 768,
      filterFields: ["userId"],
    }),

  profiles: defineTable({
    userId: v.string(),
    bio: v.optional(v.string()),
    bioSource: v.optional(v.string()),
    bioManualAnchor: v.optional(v.string()),
    bioContextFingerprint: v.optional(v.string()),
    bioClosetItemCount: v.optional(v.number()),
    bioFitCheckCount: v.optional(v.number()),
    bioCollectionCount: v.optional(v.number()),
    bioCollectionMembershipCount: v.optional(v.number()),
    bioGeneratedAt: v.optional(v.number()),
    bioLastManualEditAt: v.optional(v.number()),
    bioRevisionId: v.optional(v.id("profileBioRevisions")),
    skinTone: v.optional(v.string()),
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  profileBioRevisions: defineTable({
    userId: v.string(),
    bio: v.string(),
    source: v.union(v.literal("manual"), v.literal("agent"), v.literal("guest_import")),
    reason: v.string(),
    parentRevisionId: v.optional(v.id("profileBioRevisions")),
    contextFingerprint: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"]),

  wardrobes: defineTable({
    userId: v.string(),
    name: v.string(),
    kind: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    moodWords: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),

  candidateItems: defineTable({
    userId: v.string(),
    storageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    kind: v.string(),
    status: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userId", "kind", "status"],
    }),

  wardrobeMemberships: defineTable({
    userId: v.string(),
    wardrobeId: v.id("wardrobes"),
    itemId: v.optional(v.id("wardrobeItems")),
    candidateItemId: v.optional(v.id("candidateItems")),
    membershipKind: v.string(),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_wardrobe", ["wardrobeId"])
    .index("by_item", ["itemId"])
    .index("by_candidate", ["candidateItemId"])
    .index("by_wardrobe_item", ["wardrobeId", "itemId"]),

  fitChecks: defineTable({
    userId: v.string(),
    storageId: v.id("_storage"),
    type: fitCheckType,
    description: v.optional(v.string()),
    transcription: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_storage_type", ["userId", "storageId", "type"])
    .index("by_user_type_createdAt", ["userId", "type", "createdAt"]),

  fitCheckItems: defineTable({
    userId: v.string(),
    fitCheckId: v.id("fitChecks"),
    wardrobeItemId: v.optional(v.id("wardrobeItems")),
    source: detectedItemSource,
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    boundingBox: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      })
    ),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_fit_check", ["fitCheckId"])
    .index("by_wardrobe_item", ["wardrobeItemId"]),

  garmentObservations: defineTable({
    userId: v.string(),
    fitCheckId: v.id("fitChecks"),
    fitCheckItemId: v.id("fitCheckItems"),
    cropStorageId: v.id("_storage"),
    wardrobeItemId: v.optional(v.id("wardrobeItems")),
    category: v.string(),
    categoryKey: v.string(),
    description: v.string(),
    styleTags: v.array(v.string()),
    boundingBox: v.object({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
    }),
    detectorConfidence: v.optional(v.number()),
    visualEmbedding: v.array(v.float64()),
    semanticEmbedding: v.optional(v.array(v.float64())),
    embeddingModel: v.string(),
    detectorModel: v.string(),
    resolutionStatus: garmentResolutionStatus,
    matchScore: v.optional(v.number()),
    matchMargin: v.optional(v.number()),
    candidateItemIds: v.array(v.id("wardrobeItems")),
    candidateScores: v.array(v.number()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_fit_check", ["fitCheckId"])
    .index("by_wardrobe_item", ["wardrobeItemId"])
    .index("by_user_status", ["userId", "resolutionStatus"])
    .vectorIndex("by_visual_embedding", {
      vectorField: "visualEmbedding",
      dimensions: 768,
      filterFields: ["userId", "categoryKey", "resolutionStatus"],
    }),

  // Tracks uploads that are valid for a user but aren't yet attached to a wardrobe item
  // (e.g. quick-compare candidate uploads, selfies, etc).
  uploads: defineTable({
    userId: v.string(),
    storageId: v.id("_storage"),
    purpose: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_storage", ["userId", "storageId"])
    .index("by_user_purpose_createdAt", ["userId", "purpose", "createdAt"])
    .index("by_storage", ["storageId"]),

  subscriptions: defineTable({
    userId: v.string(),
    status: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
