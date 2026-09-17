import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/profile";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getProfile>()("getProfile"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getCurrentUser>()("getCurrentUser"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getStyleBioContext>()("getStyleBioContext"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.updateBio>()("updateBio"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.saveGeneratedBio>()("saveGeneratedBio"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.updateProfileAttributes>()("updateProfileAttributes"))
  .addFunction(FunctionSpec.convexInternalMutation<typeof functions.internalProfileUpdate>()("internalProfileUpdate"));
