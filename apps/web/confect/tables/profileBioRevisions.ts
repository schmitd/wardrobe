import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  bio: Schema.String,
  source: Schema.Union([Schema.Literal("manual"), Schema.Literal("agent"), Schema.Literal("guest_import")]),
  reason: Schema.String,
  parentRevisionId: Schema.optionalKey(Id("profileBioRevisions")),
  contextFingerprint: Schema.optionalKey(Schema.String),
  createdAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"]);
