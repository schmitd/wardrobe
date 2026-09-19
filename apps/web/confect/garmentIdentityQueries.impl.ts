import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./garmentIdentityQueries.spec";
import * as functions from "./legacy/garmentIdentityQueries";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "getGarmentObservations", functions.getGarmentObservations),
    FunctionImpl.make(databaseSchema, group, "getVisualCandidateDetails", functions.getVisualCandidateDetails),
  )),
  GroupImpl.finalize,
);
