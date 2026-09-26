import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./wear.spec";
import * as functions from "./legacy/wear";
export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(
        databaseSchema,
        group,
        "pendingPlans",
        functions.pendingPlans,
      ),
      FunctionImpl.make(databaseSchema, group, "list", functions.list),
      FunctionImpl.make(databaseSchema, group, "update", functions.update),
    ),
  ),
  GroupImpl.finalize,
);
