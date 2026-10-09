import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

export default GroupSpec.make().addFunction(FunctionSpec.internalQuery({
  name: "active",
  args: () => ({ userId: Schema.String, references: Schema.Array(Schema.Struct({ candidateItemId: Schema.String, wardrobeId: Schema.optionalKey(Schema.String) })) }),
  returns: () => Schema.mutable(Schema.Array(Schema.Boolean)),
}));
