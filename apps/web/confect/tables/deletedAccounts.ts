import { Table } from "@confect/core";
import { Schema } from "effect";

// Revokes in-flight uploads and still-valid tokens after account deletion.
export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  deletedAt: Schema.Number,
})).index("by_user", ["userId"]);
