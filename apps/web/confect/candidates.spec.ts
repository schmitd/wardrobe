import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/candidates";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.createInspiration>()("createInspiration"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.enrichInspiration>()("enrichInspiration"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listInspirationByWardrobe>()("listInspirationByWardrobe"));
