import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Exit, Layer } from "effect";
import { sevenDays } from "@wardrobe/shared";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ActionCtx } from "./_generated/services";
import schema from "./_generated/schema";
import spec from "./planningAuto.spec";
import { runInference, runServerAction } from "../src/lib/run-effect";
import { recommendWeek } from "../src/server/inference/planning";
import { dateInZone } from "../src/lib/planning-time";
import {
  PlanningCalendar,
  PlanningCalendarLive,
} from "../src/services/PlanningCalendarService";

const generate = FunctionImpl.make(
  schema,
  spec,
  "generate",
  (args): Effect.Effect<null, never, ActionCtx> =>
    Effect.gen(function* () {
      const ctx = yield* ActionCtx;
      const settings = yield* Effect.promise(() =>
        ctx.runMutation(internal.planningAutoData.claim, args),
      );
      if (!settings) return null;
      const started = Date.now();
      let error: "calendar" | "generation" = "generation";
      const work = Effect.gen(function* () {
        const week = dateInZone(settings.timezone);
        let data = yield* Effect.promise(() =>
          ctx.runQuery(internal.planningAutoData.load, { ...args, week }),
        );
        if (!data) return "stale";
        // A dismissed date is deliberate. Only genuinely absent dates are filled.
        const missing = sevenDays(week).filter(
          (date) => !data!.suggestions.some((outfit) => outfit.date === date),
        );
        if (!missing.length || !data.items.length) return "ready";
        const calendar = yield* PlanningCalendar;
        const days = yield* Effect.all(
          missing.map((date) =>
            Effect.gen(function* () {
              const context = settings.calendarEnabled
                ? yield* calendar
                    .day(
                      args.userId,
                      settings.calendarIds,
                      date,
                      settings.timezone,
                    )
                    .pipe(
                      Effect.tapError(() =>
                        Effect.sync(() => {
                          error = "calendar";
                        }),
                      ),
                    )
                : null;
              return { date, description: "", calendar: context };
            }),
          ),
          { concurrency: 7 },
        );
        const context = days
          .flatMap(
            (day) => day.calendar?.events.map((event) => event.title) ?? [],
          )
          .join(" ")
          .slice(0, 4000);
        if (context) {
          data = yield* Effect.promise(() =>
            ctx.runQuery(internal.planningAutoData.load, {
              ...args,
              week,
              context,
            }),
          );
          if (!data) return "stale";
        }
        const outfits = yield* recommendWeek({
          data,
          days,
          timezone: settings.timezone,
        });
        const committed = yield* Effect.promise(() =>
          ctx.runMutation(internal.planningAutoData.commit, {
            ...args,
            calendarDerived: settings.calendarEnabled,
            calendarRevision: settings.calendarRevision,
            outfits: outfits.map((outfit) => ({
              ...outfit,
              itemIds: outfit.itemIds as Id<"wardrobeItems">[],
            })),
          }),
        );
        return committed ? "ready" : "stale";
      }).pipe(
        Effect.provide(PlanningCalendarLive),
        Effect.timeout("85 seconds"),
      );
      const result = yield* Effect.promise(() =>
        runInference(Effect.exit(work)),
      );
      yield* Effect.promise(() =>
        ctx.runMutation(internal.planningAutoData.finish, {
          ...args,
          ...(Exit.isFailure(result) ? { error } : {}),
        }),
      );
      yield* Effect.promise(() =>
        runServerAction(
          Effect.logInfo("planning_auto.finished", {
            operation: "planning_auto",
            outcome: Exit.isFailure(result) ? error : result.value,
            duration_ms: Date.now() - started,
          }),
        ),
      );
      return null;
    }),
);
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(generate),
  GroupImpl.finalize,
);
