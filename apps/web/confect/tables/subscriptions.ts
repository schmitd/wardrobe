import { Table } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  status: Schema.optionalKey(Schema.String),
  updatedAt: Schema.Number,
})).index("by_user", ["userId"]);
