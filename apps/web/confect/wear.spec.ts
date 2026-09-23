import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/wear";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof functions.pendingPlans>()(
      "pendingPlans",
    ),
  )
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.list>()("list"))
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof functions.update>()("update"),
  );
