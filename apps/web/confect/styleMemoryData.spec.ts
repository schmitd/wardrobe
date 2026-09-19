import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/styleMemoryData";
export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof functions.watchdog>()("watchdog"))
  .addFunction(FunctionSpec.convexInternalQuery<typeof functions.load>()("load"))
  .addFunction(FunctionSpec.convexInternalMutation<typeof functions.save>()("save"))
  .addFunction(FunctionSpec.convexInternalMutation<typeof functions.finish>()("finish"));
