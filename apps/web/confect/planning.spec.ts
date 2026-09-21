import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/planning";
import { Schema } from "effect";
import RequireUser from "./middleware/RequireUser.spec";

export default GroupSpec.make()
  .addFunction(FunctionSpec.publicQuery({ name: "settings", args: () => ({}), returns: () => Schema.Struct({ calendarEnabled: Schema.Boolean, calendarIds: Schema.Array(Schema.String), calendarRevision: Schema.Number }) }).middleware(RequireUser))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.load>()("load"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.reserveGeneration>()("reserveGeneration"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.save>()("save"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.update>()("update"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.saveWeek>()("saveWeek"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.calendar>()("calendar"))
  .addFunction(FunctionSpec.convexInternalMutation<typeof functions.deleteUserData>()("deleteUserData"));
