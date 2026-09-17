import { Table } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  token: Schema.String,
  userId: Schema.String,
  state: Schema.Literals(["issued", "claimed"]),
  expiresAt: Schema.Number,
})).index("by_token", ["token"]).index("by_user", ["userId"]);
