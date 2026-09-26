import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    planId: GenericId.GenericId("outfitSuggestions"),
    revision: Schema.Number,
    itemIds: Schema.Array(GenericId.GenericId("wardrobeItems")),
    date: Schema.String,
    title: Schema.String,
    context: Schema.Array(Schema.String),
    recordedAt: Schema.Number,
  }),
)
  .index("by_plan_revision", ["planId", "revision"])
  .index("by_user", ["userId"]);
