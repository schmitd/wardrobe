import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./styleMemoryData.spec";
import * as functions from "./legacy/styleMemoryData";
export default GroupImpl.make(databaseSchema, group).pipe(Layer.provide(Layer.mergeAll(
FunctionImpl.make(databaseSchema, group, "watchdog", functions.watchdog),
FunctionImpl.make(databaseSchema, group, "load", functions.load),
FunctionImpl.make(databaseSchema, group, "save", functions.save),
FunctionImpl.make(databaseSchema, group, "finish", functions.finish),
)), GroupImpl.finalize);
