import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  storageId: GenericId.GenericId("_storage"),
  purpose: Schema.String,
  createdAt: Schema.Number,
  captureRoute: Schema.optionalKey(Schema.Struct({
  scope: Schema.Union([Schema.Literal("single_piece"), Schema.Literal("full_fit")]),
  confidence: Schema.Number,
  needsReview: Schema.Boolean,
  rationale: Schema.String,
})),
}))
    .index("by_user", ["userId"])
    .index("by_user_storage", ["userId", "storageId"])
    .index("by_user_purpose_createdAt", ["userId", "purpose", "createdAt"])
    .index("by_storage", ["storageId"]);
