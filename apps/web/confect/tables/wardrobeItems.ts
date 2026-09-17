import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  storageId: GenericId.GenericId("_storage"),
  wardrobeId: Schema.optionalKey(Id("wardrobes")),
  sourceFitCheckId: Schema.optionalKey(Id("fitChecks")),
  clientFileName: Schema.optionalKey(Schema.String),
  contentType: Schema.optionalKey(Schema.String),
  category: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  styleTags: Schema.optionalKey(Schema.Array(Schema.String)),
  embedding: Schema.optionalKey(Schema.Array(Schema.Number)),
  visualEmbedding: Schema.optionalKey(Schema.Array(Schema.Number)),
  visualEmbeddingModel: Schema.optionalKey(Schema.String),
  analysisStatus: Schema.Union([Schema.Literal("queued"), Schema.Literal("processing_tags"), Schema.Literal("processing_description"), Schema.Literal("processing_embedding"), Schema.Literal("ready"), Schema.Literal("error")]),
  analysisError: Schema.optionalKey(Schema.String),
  traceId: Schema.optionalKey(Schema.String),
  traceparent: Schema.optionalKey(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_user_storage", ["userId", "storageId"])
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
    });
