import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    occurrenceId: GenericId.GenericId("wearOccurrences"),
    revision: Schema.Number,
    itemIds: Schema.Array(GenericId.GenericId("wardrobeItems")),
    evidenceIds: Schema.Array(GenericId.GenericId("wearEvidence")),
    localDate: Schema.optionalKey(Schema.String),
    timezone: Schema.optionalKey(Schema.String),
    unresolvedCount: Schema.Number,
    active: Schema.Boolean,
    reason: Schema.Union([
      Schema.Literal("photo"),
      Schema.Literal("manual"),
      Schema.Literal("correction"),
      Schema.Literal("undo"),
      Schema.Literal("date"),
    ]),
    recordedAt: Schema.Number,
  }),
)
  .index("by_occurrence_revision", ["occurrenceId", "revision"])
  .index("by_user", ["userId"]);
