import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/garmentIdentityQueries";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getGarmentObservations>()("getGarmentObservations"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getVisualCandidateDetails>()("getVisualCandidateDetails"));
