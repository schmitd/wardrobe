import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./fitChecks.spec";
import * as functions from "./legacy/fitChecks";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "pageFitChecks", functions.pageFitChecks),
    FunctionImpl.make(databaseSchema, group, "recordFitCheck", functions.recordFitCheck),
    FunctionImpl.make(databaseSchema, group, "listFitChecks", functions.listFitChecks),
    FunctionImpl.make(databaseSchema, group, "resolveGarmentObservation", functions.resolveGarmentObservation),
    FunctionImpl.make(databaseSchema, group, "promoteGarmentObservation", functions.promoteGarmentObservation),
  )),
  GroupImpl.finalize,
);
