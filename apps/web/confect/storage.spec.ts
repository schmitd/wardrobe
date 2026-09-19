import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { StorageNotOwned } from "./errors";
import RequireUser from "./middleware/RequireUser.spec";

const storageId = GenericId.GenericId("_storage");
export const CaptureRoute = Schema.Struct({
  scope: Schema.Literals(["single_piece", "full_fit"]), confidence: Schema.Number,
  needsReview: Schema.Boolean, rationale: Schema.String,
});

export default GroupSpec.make().middleware(RequireUser)
  .addFunction(FunctionSpec.publicMutation({ name: "registerUpload",
    args: () => ({ storageId, purpose: Schema.String }),
    returns: () => Schema.Struct({ ok: Schema.Literal(true) }), error: () => StorageNotOwned,
  }))
  .addFunction(FunctionSpec.publicQuery({ name: "getStorageUrl", args: () => ({ storageId }),
    returns: () => Schema.NullOr(Schema.String), error: () => StorageNotOwned,
  }))
  .addFunction(FunctionSpec.publicQuery({ name: "getCaptureRoute", args: () => ({ storageId }),
    returns: () => Schema.NullOr(CaptureRoute), error: () => StorageNotOwned,
  }))
  .addFunction(FunctionSpec.publicMutation({ name: "saveCaptureRoute", args: () => ({ storageId, route: CaptureRoute }),
    returns: () => CaptureRoute, error: () => StorageNotOwned,
  }))
  .addFunction(FunctionSpec.publicQuery({ name: "getLatestUploadByPurpose", args: () => ({ purpose: Schema.String }),
    returns: () => Schema.NullOr(Schema.Struct({ storageId, url: Schema.String, createdAt: Schema.Number })),
  }));
