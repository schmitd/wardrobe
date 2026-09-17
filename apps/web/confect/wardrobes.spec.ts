import { FunctionSpec, GroupSpec } from "@confect/core";
import type * as functions from "./legacy/wardrobes";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.listWardrobes>()("listWardrobes"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof functions.getWardrobeDetail>()("getWardrobeDetail"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.createWardrobe>()("createWardrobe"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.updateWardrobe>()("updateWardrobe"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.addItemToWardrobe>()("addItemToWardrobe"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof functions.removeItemFromWardrobe>()("removeItemFromWardrobe"));
