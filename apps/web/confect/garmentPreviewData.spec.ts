import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
import RequireUser from "./middleware/RequireUser.spec";
import { StorageNotOwned } from "./errors";

const itemId = Id("wardrobeItems");
const storageId = GenericId.GenericId("_storage");
const jobArgs = { itemId, revision: Schema.Number };
export default GroupSpec.make()
  .addFunction(FunctionSpec.publicMutation({ name: "request", args: () => ({ itemId }), returns: () => Schema.Boolean, error: () => StorageNotOwned }).middleware(RequireUser))
  .addFunction(FunctionSpec.publicMutation({ name: "restore", args: () => ({ itemId }), returns: () => Schema.Null, error: () => StorageNotOwned }).middleware(RequireUser))
  .addFunction(FunctionSpec.publicQuery({ name: "status", args: () => ({ itemId }), returns: () => Schema.NullOr(Schema.Struct({ status: Schema.String, enabled: Schema.Boolean, imageUrl: Schema.NullOr(Schema.String) })) }).middleware(RequireUser))
  .addFunction(FunctionSpec.internalMutation({ name: "claim", args: () => jobArgs, returns: () => Schema.NullOr(Schema.Struct({ userId: Schema.String, storageId, traceId: Schema.NullOr(Schema.String) })) }))
  .addFunction(FunctionSpec.internalMutation({ name: "commit", args: () => ({ ...jobArgs, sourceStorageId: storageId, storageId, userId: Schema.String }), returns: () => Schema.Boolean }))
  .addFunction(FunctionSpec.internalMutation({ name: "finish", args: () => ({ ...jobArgs, skipped: Schema.Boolean }), returns: () => Schema.Null }))
  .addFunction(FunctionSpec.internalMutation({ name: "discard", args: () => ({ storageId }), returns: () => Schema.Null }))
  .addFunction(FunctionSpec.internalMutation({ name: "expire", args: () => jobArgs, returns: () => Schema.Null }));
