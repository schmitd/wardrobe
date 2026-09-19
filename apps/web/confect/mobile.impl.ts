import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./mobile.spec";
import * as functions from "./legacy/mobile";
export default GroupImpl.make(databaseSchema, group).pipe(Layer.provide(Layer.mergeAll(
FunctionImpl.make(databaseSchema, group, "fits", functions.fits),
FunctionImpl.make(databaseSchema, group, "bootstrap", functions.bootstrap),
FunctionImpl.make(databaseSchema, group, "plans", functions.plans),
FunctionImpl.make(databaseSchema, group, "collection", functions.collection),
)), GroupImpl.finalize);
