import { FunctionSpec, GenericId, GroupSpec, PaginationOptions } from "@confect/core";
import { Schema } from "effect";
import { StorageNotOwned } from "./errors";

const storageId = GenericId.GenericId("_storage");
const inventoryRow = Schema.Struct({ storageId, createdAt: Schema.Number, sha256: Schema.String, size: Schema.Number, registeredClaims: Schema.Array(Schema.String), claimsTruncated: Schema.Boolean, trustedOwner: Schema.NullOr(Schema.String) });
export default GroupSpec.make()
  .addFunction(FunctionSpec.internalQuery({ name: "inventory", args: () => ({ pagination: PaginationOptions.PaginationOptions }), returns: () => Schema.Struct({ page: Schema.Array(inventoryRow), isDone: Schema.Boolean, continueCursor: Schema.String }) }))
  .addFunction(FunctionSpec.internalMutation({ name: "approveReviewed", args: () => ({ storageId, userId: Schema.String, expectedSha256: Schema.String, expectedCreatedAt: Schema.Number, evidence: Schema.String }), returns: () => Schema.Null, error: () => StorageNotOwned }));
