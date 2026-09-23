import { FunctionSpec, GroupSpec, GenericId } from "@confect/core";
import { Schema } from "effect";
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "project",
    args: () => ({ id: GenericId.GenericId("wearProjectionOutbox") }),
    returns: () => Schema.Null,
  }),
);
