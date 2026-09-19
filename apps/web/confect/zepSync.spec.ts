import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/zepSync";

export default GroupSpec.makeNode()
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.bootstrapProject>()("bootstrapProject"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncWardrobeAdd>()("syncWardrobeAdd"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncWardrobeDelete>()("syncWardrobeDelete"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncProfileUpdate>()("syncProfileUpdate"))
  .addFunction(FunctionSpec.convexPublicNodeAction<typeof functions.getStyleBioGraphContext>()("getStyleBioGraphContext"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncWardrobeCollection>()("syncWardrobeCollection"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncFitCheck>()("syncFitCheck"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncGarmentIdentityResolution>()("syncGarmentIdentityResolution"))
  .addFunction(FunctionSpec.convexPublicNodeAction<typeof functions.syncCandidateComparison>()("syncCandidateComparison"))
  .addFunction(FunctionSpec.convexPublicNodeAction<typeof functions.searchStyleContext>()("searchStyleContext"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.syncCandidateInspiration>()("syncCandidateInspiration"))
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof functions.deleteUserGraph>()("deleteUserGraph"));
