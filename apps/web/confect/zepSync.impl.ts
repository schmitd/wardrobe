import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./zepSync.spec";
import * as functions from "./legacy/zepSync";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "bootstrapProject", functions.bootstrapProject),
    FunctionImpl.make(databaseSchema, group, "syncWardrobeAdd", functions.syncWardrobeAdd),
    FunctionImpl.make(databaseSchema, group, "syncWardrobeDelete", functions.syncWardrobeDelete),
    FunctionImpl.make(databaseSchema, group, "syncProfileUpdate", functions.syncProfileUpdate),
    FunctionImpl.make(databaseSchema, group, "getStyleBioGraphContext", functions.getStyleBioGraphContext),
    FunctionImpl.make(databaseSchema, group, "syncWardrobeCollection", functions.syncWardrobeCollection),
    FunctionImpl.make(databaseSchema, group, "syncFitCheck", functions.syncFitCheck),
    FunctionImpl.make(databaseSchema, group, "syncGarmentIdentityResolution", functions.syncGarmentIdentityResolution),
    FunctionImpl.make(databaseSchema, group, "syncCandidateComparison", functions.syncCandidateComparison),
    FunctionImpl.make(databaseSchema, group, "searchStyleContext", functions.searchStyleContext),
    FunctionImpl.make(databaseSchema, group, "syncCandidateInspiration", functions.syncCandidateInspiration),
    FunctionImpl.make(databaseSchema, group, "deleteUserGraph", functions.deleteUserGraph),
  )),
  GroupImpl.finalize,
);
