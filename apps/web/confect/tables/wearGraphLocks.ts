import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    jobId: GenericId.GenericId("wearProjectionOutbox"),
    startedAt: Schema.Number,
  }),
).index("by_user", ["userId"]);
