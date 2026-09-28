import { GenericId } from "@confect/core";
import { Table } from "@confect/core";
import { Schema } from "effect";

export default Table.make(() => Schema.Struct({
  userId: Schema.String,
  calendarEnabled: Schema.Boolean,
  calendarIds: Schema.Array(Schema.String),
  lastGenerationAt: Schema.Number,
  updatedAt: Schema.Number,
  lastTranscriptionAt: Schema.optionalKey(Schema.Number),
  lastInterpretationAt: Schema.optionalKey(Schema.Number),
  calendarRevision: Schema.optionalKey(Schema.Number),
  autoPlanEnabled: Schema.optionalKey(Schema.Boolean),
  autoPlanTimezone: Schema.optionalKey(Schema.String),
  autoPlanRevision: Schema.optionalKey(Schema.Number),
  autoPlanState: Schema.optionalKey(Schema.Literals(["scheduled", "running", "error", "paused"])),
  autoPlanNextAt: Schema.optionalKey(Schema.Number),
  autoPlanLastRunAt: Schema.optionalKey(Schema.Number),
  autoPlanAttempt: Schema.optionalKey(Schema.Number),
  autoPlanError: Schema.optionalKey(Schema.Literals(["calendar", "generation"])),
  autoPlanJobId: Schema.optionalKey(GenericId.GenericId("_scheduled_functions")),
})).index("by_user", ["userId"]);
