import { v } from "convex/values";
export const outfitStatus = v.union(
  v.literal("suggested"),
  v.literal("planned"),
  v.literal("worn"),
  v.literal("dismissed"),
);
export const outfitFields = {
  userId: v.string(),
  date: v.string(),
  title: v.string(),
  rationale: v.string(),
  context: v.array(v.string()),
  itemIds: v.array(v.id("wardrobeItems")),
  missing: v.array(v.string()),
  status: outfitStatus,
  calendarDerived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  reason: v.optional(v.string()),
  planRevision: v.optional(v.number()),
  wearOccurrenceId: v.optional(v.id("wearOccurrences")),
  notWornAt: v.optional(v.number()),
};
