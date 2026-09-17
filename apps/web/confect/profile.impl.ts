import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./profile.spec";
import * as functions from "./legacy/profile";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "getProfile", functions.getProfile),
    FunctionImpl.make(databaseSchema, group, "getCurrentUser", functions.getCurrentUser),
    FunctionImpl.make(databaseSchema, group, "getStyleBioContext", functions.getStyleBioContext),
    FunctionImpl.make(databaseSchema, group, "updateBio", functions.updateBio),
    FunctionImpl.make(databaseSchema, group, "saveGeneratedBio", functions.saveGeneratedBio),
    FunctionImpl.make(databaseSchema, group, "updateProfileAttributes", functions.updateProfileAttributes),
    FunctionImpl.make(databaseSchema, group, "internalProfileUpdate", functions.internalProfileUpdate),
  )),
  GroupImpl.finalize,
);
