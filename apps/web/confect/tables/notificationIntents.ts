import { Table, GenericId } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    logicalKey: Schema.String,
    kind: Schema.Union([
      Schema.Literal("daily_fit_due"),
      Schema.Literal("planned_fit_due"),
      Schema.Literal("untimed_plan_fit_due"),
    ]),
    localDate: Schema.String,
    planId: Schema.optionalKey(GenericId.GenericId("outfitSuggestions")),
    planRevision: Schema.optionalKey(Schema.Number),
    sourceRevision: Schema.Number,
    policyVersion: Schema.Number,
    preferenceRevision: Schema.Number,
    scheduleRevision: Schema.Number,
    dueAt: Schema.Number,
    expiresAt: Schema.Number,
    state: Schema.Union([
      Schema.Literal("scheduled"),
      Schema.Literal("claimed"),
      Schema.Literal("submitted"),
      Schema.Literal("suppressed"),
      Schema.Literal("expired"),
      Schema.Literal("unknown"),
      Schema.Literal("shadow"),
    ]),
    reason: Schema.optionalKey(Schema.String),
    reservationAt: Schema.optionalKey(Schema.Number),
    jobId: Schema.optionalKey(GenericId.GenericId("_scheduled_functions")),
    updatedAt: Schema.Number,
    createdAt: Schema.Number,
  }),
)
  .index("by_user_key", ["userId", "logicalKey"])
  .index("by_state_due", ["state", "dueAt"])
  .index("by_user", ["userId"])
  .index("by_user_date", ["userId", "localDate"])
  .index("by_updated", ["updatedAt"]);
