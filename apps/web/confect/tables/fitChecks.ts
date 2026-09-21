import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  storageId: GenericId.GenericId("_storage"),
  type: Schema.Union([Schema.Literal("daily_fit_check"), Schema.Literal("try_on"), Schema.Literal("candidate_fit_check")]),
  description: Schema.optionalKey(Schema.String),
  transcription: Schema.optionalKey(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  traceId: Schema.optionalKey(Schema.String),
  traceparent: Schema.optionalKey(Schema.String),
}))
    .index("by_user", ["userId"])
    .index("by_user_storage_type", ["userId", "storageId", "type"])
    .index("by_user_type_createdAt", ["userId", "type", "createdAt"]);
