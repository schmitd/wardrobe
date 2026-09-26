import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    sourceRef: Schema.String,
    kind: Schema.String,
    uuid: Schema.String,
  }),
)
  .index("by_user_ref", ["userId", "sourceRef"])
  .index("by_user", ["userId"]);
