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

export default defineSchema({
  wardrobeItems: defineTable({
    userId: v.string(),
    storageId: v.id("_storage"),
    clientFileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.number())),
    analysisStatus,
    analysisError: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"]),

  profiles: defineTable({
    userId: v.string(),
    bio: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.string(),
    status: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
