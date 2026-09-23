import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    occurrenceId: Schema.optionalKey(GenericId.GenericId("wearOccurrences")),
    planId: Schema.optionalKey(GenericId.GenericId("outfitSuggestions")),
    revision: Schema.Number,
    ontologyVersion: Schema.Number,
    state: Schema.Union([
      Schema.Literal("shadow"),
      Schema.Literal("pending"),
      Schema.Literal("sending"),
      Schema.Literal("delivered"),
      Schema.Literal("superseded"),
      Schema.Literal("uncertain"),
    ]),
    attempts: Schema.Number,
    episodeId: Schema.optionalKey(Schema.String),
    edgeIds: Schema.optionalKey(Schema.Array(Schema.String)),
    nodeIds: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          sourceRef: Schema.String,
          uuid: Schema.String,
          kind: Schema.String,
        }),
      ),
    ),
    taskIds: Schema.optionalKey(Schema.Array(Schema.String)),
    failureKind: Schema.optionalKey(Schema.String),
    recordedAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_state", ["state"])
  .index("by_occurrence_revision", ["occurrenceId", "revision"])
  .index("by_plan_revision", ["planId", "revision"])
  .index("by_user", ["userId"]);
