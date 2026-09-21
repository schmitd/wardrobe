import { Table } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  name: Schema.String,
  kind: Schema.String,
  description: Schema.optionalKey(Schema.String),
  status: Schema.String,
  moodWords: Schema.optionalKey(Schema.Array(Schema.String)),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}))
    .index("by_user", ["userId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]);
