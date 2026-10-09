import { FunctionImpl, GroupImpl } from "@confect/server";
import { Effect, Layer } from "effect";
import { sevenDays } from "@wardrobe/shared";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { CurrentUser } from "./middleware/RequireUser.spec";
import RequireUserLive from "./middleware/RequireUser.impl";
import { InvalidPlanningInput } from "./errors";
import spec from "./planningAutoData.spec";
import {
  activeAutoPlan,
  expireAutoPlan,
  finishAutoPlan,
  queueAutoPlan,
} from "./planningAutoQueue";
import { loadPlanningData, savePlanningWeek } from "./legacy/planning";
import { dateInZone } from "../src/lib/planning-time";

const configure = FunctionImpl.make(
  schema,
  spec,
  "configure",
  ({ timezone, enabled, retry }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      const { userId } = yield* CurrentUser;
      const today = yield* Effect.try({
        try: () => {
          if (timezone.length > 100) throw Error("Invalid timezone");
          return dateInZone(timezone);
        },
        catch: () =>
          new InvalidPlanningInput({ message: "Choose a valid timezone." }),
      });
      let row = yield* Effect.promise(() =>
        ctx.db
          .query("planningSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      );
      const shouldEnable = enabled ?? row?.autoPlanEnabled ?? true;
      if (!row) {
        const id = yield* Effect.promise(() =>
          ctx.db.insert("planningSettings", {
            userId,
            calendarEnabled: false,
            calendarIds: [],
            lastGenerationAt: 0,
            updatedAt: Date.now(),
          }),
        );
        row = (yield* Effect.promise(() => ctx.db.get(id)))!;
      }
      const restart =
        shouldEnable &&
        (!row.autoPlanEnabled || row.autoPlanTimezone !== timezone);
      yield* Effect.promise(() =>
        ctx.db.patch(row!._id, {
          autoPlanEnabled: shouldEnable,
          autoPlanTimezone: timezone,
        }),
      );
      if (!shouldEnable) {
        if (row.autoPlanJobId) {
          const job = yield* Effect.promise(() =>
            ctx.db.system.get(row!.autoPlanJobId!),
          );
          if (job?.state.kind === "pending")
            yield* Effect.promise(() =>
              ctx.scheduler.cancel(row!.autoPlanJobId!),
            );
        }
        yield* Effect.promise(() =>
          ctx.db.patch(row!._id, {
            autoPlanRevision: (row!.autoPlanRevision ?? 0) + 1,
            autoPlanState: "paused",
            autoPlanNextAt: 0,
            autoPlanError: undefined,
            autoPlanJobId: undefined,
          }),
        );
        return null;
      }
      if (!restart && row.autoPlanState === "running") return null;
      let missing = false;
      if (!restart && !retry && row.autoPlanState !== "error") {
        const item = yield* Effect.promise(() =>
          ctx.db
            .query("wardrobeItems")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first(),
        );
        if (item)
          for (const date of sevenDays(today)) {
            const outfit = yield* Effect.promise(() =>
              ctx.db
                .query("outfitSuggestions")
                .withIndex("by_user_date", (q) =>
                  q.eq("userId", userId).eq("date", date),
                )
                .first(),
            );
            if (!outfit) {
              missing = true;
              break;
            }
          }
      }
      if (
        restart ||
        retry ||
        (missing && (row.autoPlanNextAt ?? 0) > Date.now())
      ) {
        yield* Effect.promise(() =>
          queueAutoPlan(
            ctx,
            row!,
            Math.max(Date.now(), (row!.autoPlanLastRunAt ?? 0) + 30000),
          ),
        );
      }
      return null;
    }),
);
const claim = FunctionImpl.make(schema, spec, "claim", ({ userId, revision }) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    const row = yield* Effect.promise(() =>
      activeAutoPlan(ctx, userId, revision),
    );
    if (
      !row ||
      row.autoPlanState === "running" ||
      (row.autoPlanNextAt ?? 0) > Date.now()
    )
      return null;
    yield* Effect.promise(() =>
      ctx.db.patch(row._id, {
        autoPlanState: "running",
        autoPlanLastRunAt: Date.now(),
        autoPlanError: undefined,
      }),
    );
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(180000, expireAutoPlan, { userId, revision }),
    );
    return {
      timezone: row.autoPlanTimezone ?? "UTC",
      calendarEnabled: row.calendarEnabled,
      calendarIds: row.calendarIds,
      calendarRevision: row.calendarRevision ?? 0,
    };
  }),
);
const load = FunctionImpl.make(
  schema,
  spec,
  "load",
  ({ userId, revision, week, context }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const row = yield* Effect.promise(() =>
        activeAutoPlan(ctx, userId, revision),
      );
      if (!row || row.autoPlanState !== "running") return null;
      const data = yield* Effect.promise(() =>
        loadPlanningData(ctx, userId, { week, context }),
      );
      return {
        items: data.items.map(({ id, category, description, note }) => ({
          id,
          category,
          description,
          note,
        })),
        plans: data.plans,
        bio: data.bio,
        history: data.history,
        inventoryTruncated: data.inventoryTruncated,
        suggestions: data.suggestions.map(
          ({ date, status, itemIds, reason }) => ({
            date,
            status,
            itemIds,
            ...(reason ? { reason } : {}),
          }),
        ),
      };
    }),
);
const commit = FunctionImpl.make(
  schema,
  spec,
  "commit",
  ({ userId, revision, ...args }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      const row = yield* Effect.promise(() =>
        activeAutoPlan(ctx, userId, revision),
      );
      if (
        !row ||
        row.autoPlanState !== "running" ||
        (args.calendarDerived && !row.calendarEnabled) ||
        (row.calendarRevision ?? 0) !== args.calendarRevision
      )
        return false;
      const dates = sevenDays(dateInZone(row.autoPlanTimezone ?? "UTC"));
      if (args.outfits.some((outfit) => !dates.includes(outfit.date))) {
        // A run started before local midnight may now contain yesterday.
        // Requeue transactionally; the old action's finish cannot defer this retry.
        yield* Effect.promise(() =>
          finishAutoPlan(ctx, userId, revision, "generation"),
        );
        return false;
      }
      yield* Effect.promise(() =>
        savePlanningWeek(
          ctx,
          userId,
          {
            ...args,
            outfits: args.outfits.map((outfit) => ({
              ...outfit,
              itemIds: [...outfit.itemIds],
              context: [...outfit.context],
              missing: [...outfit.missing],
            })),
          },
          true,
        ),
      );
      return true;
    }),
);
const finish = FunctionImpl.make(
  schema,
  spec,
  "finish",
  ({ userId, revision, error }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      yield* Effect.promise(() => finishAutoPlan(ctx, userId, revision, error));
      return null;
    }),
);
const expire = FunctionImpl.make(
  schema,
  spec,
  "expire",
  ({ userId, revision }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      yield* Effect.promise(() =>
        finishAutoPlan(ctx, userId, revision, "generation"),
      );
      return null;
    }),
);
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(
    Layer.mergeAll(
      RequireUserLive,
      configure,
      claim,
      load,
      commit,
      finish,
      expire,
    ),
  ),
  GroupImpl.finalize,
);
