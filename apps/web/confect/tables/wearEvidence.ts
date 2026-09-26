import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    occurrenceId: GenericId.GenericId("wearOccurrences"),
    key: Schema.String,
    kind: Schema.Union([
      Schema.Literal("manual"),
      Schema.Literal("photo"),
      Schema.Literal("correction"),
    ]),
    fitCheckId: Schema.optionalKey(GenericId.GenericId("fitChecks")),
    itemIds: Schema.Array(GenericId.GenericId("wardrobeItems")),
    unresolvedCount: Schema.Number,
    sourceRevision: Schema.Number,
    recordedAt: Schema.Number,
    retractedAt: Schema.optionalKey(Schema.Number),
  }),
)
  .index("by_user_key", ["userId", "key"])
  .index("by_occurrence", ["occurrenceId"])
  .index("by_fit", ["fitCheckId"])
  .index("by_user", ["userId"]);
