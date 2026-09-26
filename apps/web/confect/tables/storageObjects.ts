import { GenericId, Table } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  storageId: GenericId.GenericId("_storage"),
  userId: Schema.String,
  provenance: Schema.Literals(["upload", "reviewed_legacy", "generated_preview"]),
  createdAt: Schema.Number,
  reviewEvidence: Schema.optionalKey(Schema.String),
  reviewedAt: Schema.optionalKey(Schema.Number),
})).index("by_storage", ["storageId"]).index("by_user", ["userId"]);
