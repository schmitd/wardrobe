import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  storageId: Schema.optionalKey(GenericId.GenericId("_storage")),
  sourceUrl: Schema.optionalKey(Schema.String),
  sourceLabel: Schema.optionalKey(Schema.String),
  kind: Schema.String,
  status: Schema.String,
  category: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  styleTags: Schema.optionalKey(Schema.Array(Schema.String)),
  embedding: Schema.optionalKey(Schema.Array(Schema.Number)),
  traceId: Schema.optionalKey(Schema.String),
  traceparent: Schema.optionalKey(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userId", "kind", "status"],
    });
