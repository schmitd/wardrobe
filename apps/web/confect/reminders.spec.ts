import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/reminders";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.clearCalendarLinks>()(
      "clearCalendarLinks",
    ),
  )
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof functions.settings>()("settings"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.preferences>()(
      "preferences",
    ),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.register>()("register"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.revoke>()("revoke"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.capture>()("capture"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.schedule>()("schedule"),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.reconcile>()(
      "reconcile",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.claim>()("claim"),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof functions.submission>()(
      "submission",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.finish>()("finish"),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.quarantine>()(
      "quarantine",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.receiptAttempt>()(
      "receiptAttempt",
    ),
  )
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.open>()("open"))
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.sweep>()("sweep"),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof functions.calendarSource>()(
      "calendarSource",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.calendarResult>()(
      "calendarResult",
    ),
  );
