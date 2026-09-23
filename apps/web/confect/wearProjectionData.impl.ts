import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import schema from "./_generated/schema";
import group from "./wearProjectionData.spec";
import * as functions from "./legacy/wearProjectionData";
export default GroupImpl.make(schema, group).pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(
        schema,
        group,
        "quarantineStalled",
        functions.quarantineStalled,
      ),
      FunctionImpl.make(
        schema,
        group,
        "activateShadowBatch",
        functions.activateShadowBatch,
      ),
      FunctionImpl.make(schema, group, "claim", functions.claim),
      FunctionImpl.make(schema, group, "finish", functions.finish),
      FunctionImpl.make(schema, group, "progress", functions.progress),
      FunctionImpl.make(schema, group, "references", functions.references),
      FunctionImpl.make(schema, group, "currentFacts", functions.currentFacts),
    ),
  ),
  GroupImpl.finalize,
);
