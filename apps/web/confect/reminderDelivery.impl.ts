import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import schema from "./_generated/schema";
import group from "./reminderDelivery.spec";
import * as functions from "./legacy/reminderDelivery";
export default GroupImpl.make(schema, group).pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(schema, group, "deliver", functions.deliver),
      FunctionImpl.make(schema, group, "receipt", functions.receipt),
      FunctionImpl.make(
        schema,
        group,
        "refreshCalendar",
        functions.refreshCalendar,
      ),
    ),
  ),
  GroupImpl.finalize,
);
