import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/fitChecks";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.pageFitChecks>()("pageFitChecks"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.recordFitCheck>()("recordFitCheck"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listFitChecks>()("listFitChecks"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.resolveGarmentObservation>()("resolveGarmentObservation"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.promoteGarmentObservation>()("promoteGarmentObservation"));
