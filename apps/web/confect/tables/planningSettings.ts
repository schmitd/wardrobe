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
})).index("by_user", ["userId"]);
