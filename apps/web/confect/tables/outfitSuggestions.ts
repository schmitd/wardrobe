import { Table } from "@confect/core";
import { Schema } from "effect";
import { Id } from "../_generated/id";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  date: Schema.String,
  title: Schema.String,
  rationale: Schema.String,
  context: Schema.Array(Schema.String),
  itemIds: Schema.Array(Id("wardrobeItems")),
  missing: Schema.Array(Schema.String),
  status: Schema.Union([Schema.Literal("suggested"), Schema.Literal("planned"), Schema.Literal("worn"), Schema.Literal("dismissed")]),
  calendarDerived: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  recommendationRequests: Schema.optionalKey(Schema.Array(Schema.String)),
  recommendationSignals: Schema.optionalKey(Schema.Array(Schema.Struct({ itemId: Id("wardrobeItems"), at: Schema.Number }))),
  reason: Schema.optionalKey(Schema.String),
}))
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]);
