import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/mobile";
export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.fits>()("fits"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.bootstrap>()("bootstrap"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.plans>()("plans"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.collection>()("collection"));
