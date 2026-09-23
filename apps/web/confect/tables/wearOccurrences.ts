import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    planId: Schema.optionalKey(GenericId.GenericId("outfitSuggestions")),
    planRevision: Schema.optionalKey(Schema.Number),
    localDate: Schema.optionalKey(Schema.String),
    timezone: Schema.optionalKey(Schema.String),
    revision: Schema.Number,
    itemIds: Schema.Array(GenericId.GenericId("wardrobeItems")),
    unresolvedCount: Schema.Number,
    active: Schema.Boolean,
    coverage: Schema.Union([
      Schema.Literal("partial"),
      Schema.Literal("supported"),
    ]),
    outcome: Schema.Union([
      Schema.Literal("unconfirmed"),
      Schema.Literal("confirmed_as_planned"),
      Schema.Literal("worn_differently"),
    ]),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_user", ["userId"])
  .index("by_user_date", ["userId", "localDate"])
  .index("by_plan", ["planId"]);
