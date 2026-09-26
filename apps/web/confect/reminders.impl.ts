import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import schema from "./_generated/schema";
import group from "./reminders.spec";
import * as functions from "./legacy/reminders";
export default GroupImpl.make(schema, group).pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(
        schema,
        group,
        "clearCalendarLinks",
        functions.clearCalendarLinks,
      ),
      FunctionImpl.make(schema, group, "settings", functions.settings),
      FunctionImpl.make(schema, group, "preferences", functions.preferences),
      FunctionImpl.make(schema, group, "register", functions.register),
      FunctionImpl.make(schema, group, "revoke", functions.revoke),
      FunctionImpl.make(schema, group, "capture", functions.capture),
      FunctionImpl.make(schema, group, "schedule", functions.schedule),
      FunctionImpl.make(schema, group, "reconcile", functions.reconcile),
      FunctionImpl.make(schema, group, "claim", functions.claim),
      FunctionImpl.make(schema, group, "submission", functions.submission),
      FunctionImpl.make(schema, group, "finish", functions.finish),
      FunctionImpl.make(schema, group, "quarantine", functions.quarantine),
      FunctionImpl.make(
        schema,
        group,
        "receiptAttempt",
        functions.receiptAttempt,
      ),
      FunctionImpl.make(schema, group, "open", functions.open),
      FunctionImpl.make(schema, group, "sweep", functions.sweep),
      FunctionImpl.make(
        schema,
        group,
        "calendarSource",
        functions.calendarSource,
      ),
      FunctionImpl.make(
        schema,
        group,
        "calendarResult",
        functions.calendarResult,
      ),
    ),
  ),
  GroupImpl.finalize,
);
