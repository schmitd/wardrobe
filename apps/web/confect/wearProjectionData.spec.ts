import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/wearProjectionData";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.quarantineStalled>()(
      "quarantineStalled",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.activateShadowBatch>()(
      "activateShadowBatch",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.claim>()("claim"),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.finish>()("finish"),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof functions.progress>()(
      "progress",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof functions.references>()(
      "references",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalQuery<typeof functions.currentFacts>()(
      "currentFacts",
    ),
  );
