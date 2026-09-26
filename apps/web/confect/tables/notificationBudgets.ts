import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    localDate: Schema.String,
    count: Schema.Number,
    lastReservedAt: Schema.Number,
    lastDailyAt: Schema.optionalKey(Schema.Number),
  }),
).index("by_user", ["userId"]);
