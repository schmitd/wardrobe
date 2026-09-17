import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import { QueryCtx } from "./_generated/services";
import { CurrentUser } from "./middleware/RequireUser.spec";
import RequireUserLive from "./middleware/RequireUser.impl";
import databaseSchema from "./_generated/schema";
import group from "./planning.spec";
import * as functions from "./legacy/planning";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    RequireUserLive,
    FunctionImpl.make(databaseSchema, group, "settings", () => Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const settings = yield* Effect.promise(() => ctx.db.query("planningSettings").withIndex("by_user", q => q.eq("userId", userId)).unique());
      return { calendarEnabled: settings?.calendarEnabled ?? false, calendarIds: settings?.calendarIds ?? [], calendarRevision: settings?.calendarRevision ?? 0 };
    })),
    FunctionImpl.make(databaseSchema, group, "load", functions.load),
    FunctionImpl.make(databaseSchema, group, "reserveGeneration", functions.reserveGeneration),
    FunctionImpl.make(databaseSchema, group, "save", functions.save),
    FunctionImpl.make(databaseSchema, group, "update", functions.update),
    FunctionImpl.make(databaseSchema, group, "saveWeek", functions.saveWeek),
    FunctionImpl.make(databaseSchema, group, "calendar", functions.calendar),
    FunctionImpl.make(databaseSchema, group, "deleteUserData", functions.deleteUserData),
  )),
  GroupImpl.finalize,
);
