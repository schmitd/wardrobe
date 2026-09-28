import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "generate",
    args: () => ({ userId: Schema.String, revision: Schema.Number }),
    returns: () => Schema.Null,
  }),
);
