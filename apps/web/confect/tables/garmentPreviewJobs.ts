import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  itemId: Id("wardrobeItems"),
  revision: Schema.Number,
})).index("by_user", ["userId"]).index("by_item_revision", ["itemId", "revision"]);
