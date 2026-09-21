import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  fitCheckId: Id("fitChecks"),
  fitCheckItemId: Id("fitCheckItems"),
  cropStorageId: GenericId.GenericId("_storage"),
  wardrobeItemId: Schema.optionalKey(Id("wardrobeItems")),
  category: Schema.String,
  categoryKey: Schema.String,
  description: Schema.String,
  styleTags: Schema.Array(Schema.String),
  boundingBox: Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
}),
  detectorConfidence: Schema.optionalKey(Schema.Number),
  visualEmbedding: Schema.Array(Schema.Number),
  semanticEmbedding: Schema.optionalKey(Schema.Array(Schema.Number)),
  embeddingModel: Schema.String,
  detectorModel: Schema.String,
  resolutionStatus: Schema.Union([Schema.Literal("auto_matched"), Schema.Literal("needs_confirmation"), Schema.Literal("confirmed"), Schema.Literal("unresolved"), Schema.Literal("promoted_new"), Schema.Literal("rejected")]),
  matchScore: Schema.optionalKey(Schema.Number),
  matchMargin: Schema.optionalKey(Schema.Number),
  candidateItemIds: Schema.Array(Id("wardrobeItems")),
  candidateScores: Schema.Array(Schema.Number),
  resolvedAt: Schema.optionalKey(Schema.Number),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_fit_check", ["fitCheckId"])
    .index("by_wardrobe_item", ["wardrobeItemId"])
    .index("by_user_status", ["userId", "resolutionStatus"])
    .vectorIndex("by_visual_embedding", {
      vectorField: "visualEmbedding",
      dimensions: 768,
      filterFields: ["userId", "categoryKey", "resolutionStatus"],
    });
