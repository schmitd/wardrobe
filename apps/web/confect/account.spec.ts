import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(FunctionSpec.internalMutation({ name: "deleteUserData", args: () => ({ userId: Schema.String }), returns: () => Schema.Struct({ scheduled: Schema.Literal(true) }) }))
  .addFunction(FunctionSpec.internalMutation({ name: "deleteBatch", args: () => ({ userId: Schema.String, tableIndex: Schema.Number }), returns: () => Schema.Null }));
