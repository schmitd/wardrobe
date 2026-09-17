import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
export default GroupSpec.makeNode().addFunction(FunctionSpec.internalNodeAction({ name: "refresh", args: () => ({ userId: Schema.String }), returns: () => Schema.Null }));
