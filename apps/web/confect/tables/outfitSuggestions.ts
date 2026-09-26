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
  reason: Schema.optionalKey(Schema.String),
  planRevision: Schema.optionalKey(Schema.Number),
  wearOccurrenceId: Schema.optionalKey(Id("wearOccurrences")),
  reminderScheduleRevision: Schema.optionalKey(Schema.Number),
  reminderCalendarId: Schema.optionalKey(Schema.String),
  reminderEventId: Schema.optionalKey(Schema.String),
  reminderCalendarRevision: Schema.optionalKey(Schema.Number),
  reminderCalendarCheckedAt: Schema.optionalKey(Schema.Number),
  reminderCalendarActive: Schema.optionalKey(Schema.Boolean),
  reminderNextRefreshAt: Schema.optionalKey(Schema.Number),
  reminderStartsAt: Schema.optionalKey(Schema.Number),
  reminderEndsAt: Schema.optionalKey(Schema.Number),
  reminderTimezone: Schema.optionalKey(Schema.String),
  reminderTimeConfirmedAt: Schema.optionalKey(Schema.Number),
  notWornAt: Schema.optionalKey(Schema.Number),
}))
    .index("by_reminder_refresh", ["reminderNextRefreshAt"])
    .index("by_user", ["userId"])
    .index("by_user_status_date", ["userId", "status", "date"])
    .index("by_user_date", ["userId", "date"]);
