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
  v.literal("transcribed_only")
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
    }),

  profiles: defineTable({
    userId: v.string(),
    bio: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

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

  wardrobeMemberships: defineTable({
    userId: v.string(),
    wardrobeId: v.id("wardrobes"),
    itemId: v.id("wardrobeItems"),
    membershipKind: v.string(),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_wardrobe", ["wardrobeId"])
    .index("by_item", ["itemId"])
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
