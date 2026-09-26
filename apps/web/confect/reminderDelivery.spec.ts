import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/reminderDelivery";
export default GroupSpec.makeNode()
  .addFunction(
    FunctionSpec.convexInternalNodeAction<typeof functions.deliver>()(
      "deliver",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalNodeAction<typeof functions.receipt>()(
      "receipt",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalNodeAction<typeof functions.refreshCalendar>()(
      "refreshCalendar",
    ),
  );
