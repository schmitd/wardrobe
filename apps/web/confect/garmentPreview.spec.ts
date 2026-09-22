import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
export default GroupSpec.makeNode().addFunction(FunctionSpec.internalNodeAction({ name: "generate", args: () => ({ itemId: Id("wardrobeItems"), revision: Schema.Number }), returns: () => Schema.Null }));
