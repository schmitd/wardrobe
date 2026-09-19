import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./candidates.spec";
import * as functions from "./legacy/candidates";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "createInspiration", functions.createInspiration),
    FunctionImpl.make(databaseSchema, group, "enrichInspiration", functions.enrichInspiration),
    FunctionImpl.make(databaseSchema, group, "listInspirationByWardrobe", functions.listInspirationByWardrobe),
  )),
  GroupImpl.finalize,
);
